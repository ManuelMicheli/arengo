import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runEngine } from "../src/core/index";
import type { EngineInput } from "../src/core/index";
import { SEED_CONFIG } from "./fixtures";
import { BASE_OPTIONS, generatePolarized } from "./synthetic";

const data = generatePolarized({ ...BASE_OPTIONS, groupSizes: [70, 70, 70], polarizedItems: 9 });
const pseudos = new Set(data.truth.keys());
const eligible = [...pseudos];
const input: EngineInput = {
  votes: data.votes,
  account_age_days: data.ages,
  history: {},
  jury_eligible: eligible,
  reputation_events: eligible.map((author, i) => ({
    author,
    rater: eligible[(i * 11 + 5) % eligible.length] as string,
    age_days: i % 120,
  })),
  seed: "privacy",
  config: SEED_CONFIG,
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Visita il JSON e restituisce [percorso, valore] per ogni stringa (valori e chiavi). */
function strings(node: Json, path = "$"): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((x) => strings(x, `${path}[*]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => [[`${path}.<key>`, k] as [string, string], ...strings(v, `${path}.${k}`)]);
  }
  return [];
}

/** Tutti gli oggetti del JSON con il loro percorso. */
function objects(node: Json, path = "$"): [string, Record<string, Json>][] {
  if (Array.isArray(node)) return node.flatMap((x) => objects(x, `${path}[*]`));
  if (node && typeof node === "object") {
    return [[path, node], ...Object.entries(node).flatMap(([k, v]) => objects(v, `${path}.${k}`))];
  }
  return [];
}

describe("output serializzato: nessuna associazione pseudo → gruppo", () => {
  const result = runEngine(input);
  const output = JSON.parse(JSON.stringify(result.output)) as Json;

  it("gli pseudo compaiono solo nei membri dei panel e nella reputazione", () => {
    const paths = new Set(strings(output).filter(([, s]) => pseudos.has(s)).map(([p]) => p));
    expect(paths.size).toBeGreaterThan(0);
    expect([...paths].sort()).toEqual(["$.private.jury_panels[*].members[*]", "$.private.reputation[*].pseudo"]);
  });

  it("output.public serializzato non contiene nessuno pseudo dell'input", () => {
    const json = JSON.stringify(result.output.public);
    const all = new Set<string>([
      ...input.votes.map((v) => v.pseudo),
      ...Object.keys(input.account_age_days),
      ...input.jury_eligible,
      ...input.reputation_events.flatMap((e) => [e.author, e.rater]),
    ]);
    expect(all.size).toBeGreaterThan(200);
    for (const p of all) expect(json.includes(p), p).toBe(false);
  });

  it("le etichette di gruppo compaiono solo negli aggregati (cluster e per item)", () => {
    const paths = new Set(strings(output).filter(([, s]) => /Gruppo/.test(s)).map(([p]) => p));
    expect([...paths].sort()).toEqual(["$.public.clusters[*].label", "$.public.items[*].groups[*].group"]);
  });

  it("nessun oggetto contiene insieme uno pseudo e un'etichetta di gruppo", () => {
    for (const [path, obj] of objects(output)) {
      // solo i campi diretti dell'oggetto (stringhe o array di stringhe), non i figli
      const values = Object.entries(obj).flatMap(([k, v]): [string, string][] => [
        [k, k],
        ...(typeof v === "string" ? [[k, v] as [string, string]] : []),
        ...(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => [k, x] as [string, string]) : []),
      ]);
      const hasPseudo = values.some(([, s]) => pseudos.has(s));
      const hasGroup = values.some(([, s]) => /Gruppo/.test(s));
      expect(hasPseudo && hasGroup, path).toBe(false);
    }
  });

  it("panel e reputazione hanno solo i campi previsti e sono in ordine alfabetico", () => {
    const out = result.output.private;
    expect(out.jury_panels.length).toBeGreaterThan(0);
    for (const p of out.jury_panels) {
      expect(Object.keys(p).sort()).toEqual(["diversity", "members", "panel_id"]);
      expect(typeof p.diversity).toBe("boolean");
      expect([...p.members]).toEqual([...p.members].sort());
    }
    for (const r of out.reputation) expect(Object.keys(r).sort()).toEqual(["pseudo", "score"]);
    const rep = out.reputation.map((r) => r.pseudo);
    expect(rep).toEqual([...rep].sort());
  });

  it("l'output è diviso in public (solo aggregati) e private (panel, reputazione)", () => {
    expect(Object.keys(result.output).sort()).toEqual(["private", "public"]);
    expect(Object.keys(result.output.public).sort()).toEqual(
      ["clusters", "insufficient_reason", "items", "items_considered", "k", "outcome", "participants", "silhouette"].sort(),
    );
    expect(Object.keys(result.output.private).sort()).toEqual(["jury_panels", "reputation"]);
    for (const c of result.output.public.clusters) expect(Object.keys(c).sort()).toEqual(["below_share", "label", "size"]);
  });

  it("anche serializzando l'intero risultato i gruppi in memoria non escono", () => {
    const whole = JSON.parse(JSON.stringify(result)) as { groups: unknown };
    expect(whole.groups).toEqual({ k: 3 });
  });
});

describe("il core non logga", () => {
  const methods = ["log", "info", "warn", "error", "debug", "trace"] as const;
  afterEach(() => vi.restoreAllMocks());

  it("nessuna chiamata a console.* durante la run (esito clustered e insufficient)", () => {
    const spies = methods.map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    runEngine(input);
    runEngine({ ...input, config: { ...SEED_CONFIG, min_participants_for_clustering: 10_000 } });
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it("i sorgenti del core non usano console, I/O, rete o variabili d'ambiente", () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "core");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/\bconsole\./);
      expect(src, f).not.toMatch(/\bprocess\./);
      expect(src, f).not.toMatch(/\bfetch\(/);
      expect(src, f).not.toMatch(/from\s+["'](node:|fs|path|http|https|net|child_process|@supabase)/);
    }
  });
});
