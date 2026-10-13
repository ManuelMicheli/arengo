import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LexiconEntry } from "./check-content";
import { guardContent, RULE_MESSAGES, type ModerationDeps } from "./guard";

const SECRET_TEXT = "sei un parolaccia1 testo-privato-da-non-salvare";
const LEXICON: LexiconEntry[] = [
  { term: "parolaccia1", level: 2, isPattern: false },
  { term: "odiotermine", level: 3, isPattern: false },
];

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
let spies: Array<{ mock: { calls: unknown[][] } }> = [];

beforeEach(() => {
  spies = CONSOLE_METHODS.map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  vi.restoreAllMocks();
});

function consoleOutput(): string {
  return JSON.stringify(spies.map((s) => s.mock.calls));
}

function makeDeps(overrides: Partial<ModerationDeps> = {}) {
  const calls: unknown[] = [];
  const deps: ModerationDeps = {
    loadLexicon: vi.fn(async () => LEXICON),
    writingPausedUntil: vi.fn(async () => null),
    recordBlock: vi.fn(async (...args: unknown[]) => {
      calls.push(args);
      return null;
    }),
    ...overrides,
  };
  return { deps, calls };
}

describe("guardContent", () => {
  it("testo ammesso: nessuna registrazione", async () => {
    const { deps } = makeDeps();
    await expect(guardContent("una critica dura alla proposta", "piazza", deps)).resolves.toEqual({ ok: true });
    expect(deps.recordBlock).not.toHaveBeenCalled();
  });

  it("testo bloccato: registra solo livello e tipo, messaggio con la regola", async () => {
    const { deps, calls } = makeDeps();
    const r = await guardContent(SECRET_TEXT, "argument", deps);
    expect(r).toMatchObject({ ok: false, reason: "blocked", level: 2, rule: "insulto_a_utente" });
    expect(calls).toEqual([[2, "argument"]]);
    if (!r.ok) expect(r.message).toBe(RULE_MESSAGES.insulto_a_utente);
  });

  it("il testo bloccato non finisce in console, RPC, esito o messaggio", async () => {
    const { deps, calls } = makeDeps();
    const r = await guardContent(SECRET_TEXT, "piazza", deps);
    const leaked = [consoleOutput(), JSON.stringify(calls), JSON.stringify(r)];
    for (const s of leaked) {
      expect(s).not.toContain("testo-privato-da-non-salvare");
      expect(s).not.toContain("parolaccia1");
    }
  });

  it("se la registrazione fallisce, l'errore non contiene il testo", async () => {
    const { deps } = makeDeps({
      recordBlock: vi.fn(async () => {
        throw new Error("moderation_rpc_failed");
      }),
    });
    const err = await guardContent(SECRET_TEXT, "piazza", deps).catch((e: unknown) => e);
    expect(String(err)).not.toContain("testo-privato");
    expect(consoleOutput()).not.toContain("testo-privato");
  });

  it("utente in pausa: niente controllo né registrazione", async () => {
    const until = new Date("2026-10-13T10:30:00Z");
    const { deps } = makeDeps({ writingPausedUntil: vi.fn(async () => until) });
    const r = await guardContent("testo qualsiasi", "piazza", deps);
    expect(r).toMatchObject({ ok: false, reason: "paused", pausedUntil: until });
    if (!r.ok) expect(r.message).toContain("12:30");
    expect(deps.loadLexicon).not.toHaveBeenCalled();
    expect(deps.recordBlock).not.toHaveBeenCalled();
  });

  it("blocco che fa scattare la pausa: messaggio con regola e orario", async () => {
    const until = new Date("2026-10-13T10:30:00Z");
    const { deps } = makeDeps({ recordBlock: vi.fn(async () => until) });
    const r = await guardContent("odiotermine", "bar", deps);
    expect(r).toMatchObject({ ok: false, reason: "blocked", level: 3, pausedUntil: until });
    if (!r.ok) {
      expect(r.message).toContain(RULE_MESSAGES.insulto_odio);
      expect(r.message).toContain("12:30");
    }
  });
});
