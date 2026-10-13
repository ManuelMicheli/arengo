import { describe, expect, it } from "vitest";
import {
  buildCenteredMatrix,
  chooseK,
  project2D,
  rngFromSeed,
  runEngine,
  selectItems,
  selectParticipants,
} from "../src/core/index";
import type { EngineInput, Vote } from "../src/core/index";
import { SEED_CONFIG } from "./fixtures";
import { BASE_OPTIONS, generatePolarized, type SyntheticData } from "./synthetic";

function inputFrom(data: SyntheticData, extra: Partial<EngineInput> = {}): EngineInput {
  return {
    votes: data.votes,
    account_age_days: data.ages,
    history: {},
    jury_eligible: [],
    reputation_events: [],
    seed: "run-test",
    config: SEED_CONFIG,
    ...extra,
  };
}

const classifications = (items: readonly { item: string; classification: unknown }[]) =>
  Object.fromEntries(items.map((r) => [r.item, r.classification]));

describe("E1.4 — 2 gruppi polarizzati (200 utenti) + 5 item trasversali", () => {
  const data = generatePolarized(BASE_OPTIONS);
  const { output } = runEngine(inputFrom(data));

  it("trova 2 gruppi di dimensione simile", () => {
    expect(output.outcome).toBe("clustered");
    expect(output.k).toBe(2);
    expect(output.clusters.map((c) => c.label)).toEqual(["Gruppo 1", "Gruppo 2"]);
    expect(output.clusters.reduce((s, c) => s + c.size, 0)).toBe(output.participants);
    for (const c of output.clusters) expect(c.size).toBeGreaterThanOrEqual(90);
  });

  it("gli item trasversali sono ponte", () => {
    for (const item of data.bridges) {
      const r = output.items.find((x) => x.item === item);
      expect(r?.classification, item).toBe("ponte");
    }
  });

  it("gli item polarizzati sono divisivi", () => {
    for (const item of data.polarized) {
      const r = output.items.find((x) => x.item === item);
      expect(r?.classification, item).toBe("divisivo");
    }
  });

  it("k = 2 < jury_min_buckets: panel con membri di entrambi i gruppi, diversity true", () => {
    const panels = runEngine(inputFrom(data, { jury_eligible: [...data.truth.keys()] })).output.jury_panels;
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) {
      expect(p.members).toHaveLength(SEED_CONFIG.jury_size);
      expect(new Set(p.members.map((m) => data.truth.get(m))).size).toBe(2);
      expect(p.diversity).toBe(true);
    }
  });

  it("stable_ponte solo con lo storico: ponte anche nella run precedente", () => {
    const history = Object.fromEntries(data.bridges.map((b) => [b, ["ponte" as const]]));
    const withHistory = runEngine(inputFrom(data, { history })).output;
    for (const item of data.bridges) {
      expect(output.items.find((x) => x.item === item)?.stable_ponte).toBe(false);
      expect(withHistory.items.find((x) => x.item === item)?.stable_ponte).toBe(true);
    }
  });
});

describe("E1.4 — brigading", () => {
  const data = generatePolarized(BASE_OPTIONS);
  const brigade: Vote[] = [];
  const brigadeAges: Record<string, number> = {};
  for (let i = 0; i < 50; i++) {
    const pseudo = `brig-${i}`;
    brigadeAges[pseudo] = SEED_CONFIG.min_account_age_days_for_engine - 1;
    for (const item of data.bridges) brigade.push({ pseudo, item, value: -1 });
    for (const item of data.polarized) brigade.push({ pseudo, item, value: 1 });
    brigade.push({ pseudo, item: "solo-brigata", value: 1 });
  }
  const clean = runEngine(inputFrom(data)).output;
  const attacked = runEngine(
    inputFrom(data, { votes: [...data.votes, ...brigade], account_age_days: { ...data.ages, ...brigadeAges } }),
  ).output;

  it("50 account più giovani di min_account_age_days_for_engine non cambiano nessuna classificazione", () => {
    expect(classifications(attacked.items)).toEqual(classifications(clean.items));
  });

  it("50 account nuovi (e 10 senza voti) che danno \"utile\" in blocco non cambiano la reputazione di nessuno", () => {
    const authors = [...data.truth.keys()].slice(0, 20);
    const honest = authors.map((author, i) => ({ author, rater: authors[(i + 1) % authors.length] as string, age_days: i }));
    const lurkers: Record<string, number> = {};
    for (let i = 0; i < 10; i++) lurkers[`lurker-${i}`] = 365; // account vecchi ma con meno di min_votes_participant voti
    const raters = [...Object.keys(brigadeAges), ...Object.keys(lurkers)];
    const attack = raters.flatMap((rater) =>
      [...authors.slice(0, 3), "autore-della-brigata"].map((author) => ({ author, rater, age_days: 0 })),
    );
    const cleanRep = runEngine(inputFrom(data, { reputation_events: honest })).output.reputation;
    const attackedRep = runEngine(
      inputFrom(data, {
        votes: [...data.votes, ...brigade],
        account_age_days: { ...data.ages, ...brigadeAges, ...lurkers },
        reputation_events: [...honest, ...attack],
      }),
    ).output.reputation;
    expect(cleanRep.length).toBeGreaterThan(0);
    expect(attackedRep).toEqual(cleanRep);
  });

  it("l'output è identico: gli account esclusi non entrano nel calcolo", () => {
    expect(attacked).toEqual(clean);
    expect(attacked.items.some((r) => r.item === "solo-brigata")).toBe(false);
  });
});

describe("E1.4 — determinismo", () => {
  const data = generatePolarized({ ...BASE_OPTIONS, groupSizes: [70, 70, 70], polarizedItems: 9 });
  const eligible = [...data.truth.keys()];
  const events = eligible.slice(0, 30).map((author, i) => ({
    author,
    rater: eligible[(i * 7 + 3) % eligible.length] as string,
    age_days: i,
  }));
  const base = inputFrom(data, { jury_eligible: eligible, reputation_events: events });

  it("stesso seed → output deep-equal", () => {
    expect(runEngine(base).output).toEqual(runEngine(base).output);
  });

  it("l'ordine dei voti in input non conta", () => {
    const reversed = { ...base, votes: [...base.votes].reverse(), jury_eligible: [...eligible].reverse() };
    expect(runEngine(reversed).output).toEqual(runEngine(base).output);
  });

  it("seed diverso → panel giuria diversi", () => {
    const a = runEngine(base).output.jury_panels;
    const b = runEngine({ ...base, seed: "altro-seed" }).output.jury_panels;
    expect(a.length).toBeGreaterThan(0);
    expect(b).not.toEqual(a);
  });

  /**
   * Ricostruisce la partizione della run con le stesse funzioni pure e lo stesso seed:
   * il motore non la espone, il test la ricalcola per verificare i panel.
   */
  function partitionOf(input: EngineInput): Map<string, number> {
    const parts = selectParticipants(input.votes, input.account_age_days, input.config);
    const items = selectItems(input.votes, new Set(parts), input.config);
    const points = project2D(buildCenteredMatrix(input.votes, parts, items).centered);
    const best = chooseK(points, input.config.k_min, input.config.k_max, rngFromSeed(`${input.seed}:kmeans`))!;
    return new Map(parts.map((p, i) => [p, best.assignments[i] as number]));
  }

  it("3 gruppi: i cluster coincidono con i gruppi veri per ≥ 95% dei partecipanti", () => {
    const { output } = runEngine(base);
    expect(output.k).toBe(3);
    const partition = partitionOf(base);
    const agree = new Map<string, number>();
    for (const [p, c] of partition) {
      const key = `${data.truth.get(p)}-${c}`;
      agree.set(key, (agree.get(key) ?? 0) + 1);
    }
    const majority = [...agree.values()].sort((a, b) => b - a).slice(0, 3).reduce((s, x) => s + x, 0);
    expect(majority / partition.size).toBeGreaterThanOrEqual(0.95);
  });

  it("3 gruppi: ogni panel ha jury_size membri da ≥ jury_min_buckets gruppi della run", () => {
    const { output } = runEngine(base);
    const partition = partitionOf(base);
    expect(output.jury_panels.length).toBeGreaterThan(0);
    for (const p of output.jury_panels) {
      expect(p.members).toHaveLength(SEED_CONFIG.jury_size);
      const groups = new Set(p.members.map((m) => partition.get(m)));
      expect(groups.has(undefined)).toBe(false);
      expect(groups.size).toBeGreaterThanOrEqual(SEED_CONFIG.jury_min_buckets);
    }
  });

  it("drawStratified sui gruppi della run è proporzionale ai gruppi veri", () => {
    const { groups } = runEngine(base);
    const drawn = groups.drawStratified(eligible, "sha256-di-esempio", 9);
    const per = [0, 0, 0];
    for (const p of drawn) per[data.truth.get(p)!]!++;
    expect(per).toEqual([3, 3, 3]);
  });
});

describe("E1.4 — partecipanti sotto min_participants_for_clustering", () => {
  const data = generatePolarized({ ...BASE_OPTIONS, groupSizes: [20, 20] });
  const { output, groups } = runEngine(inputFrom(data, { jury_eligible: [...data.truth.keys()] }));

  it("esito insufficient con sole approvazioni totali", () => {
    expect(output.participants).toBeLessThan(SEED_CONFIG.min_participants_for_clustering);
    expect(output.outcome).toBe("insufficient");
    expect(output.insufficient_reason).toBe("too_few_participants");
    expect(output.k).toBeNull();
    expect(output.silhouette).toBeNull();
    expect(output.clusters).toEqual([]);
    // nessun gruppo: panel casuali tra gli idonei, marcati diversity false
    expect(output.jury_panels).toHaveLength(Math.floor(data.truth.size / SEED_CONFIG.jury_size));
    for (const p of output.jury_panels) {
      expect(p.diversity).toBe(false);
      expect(p.members).toHaveLength(SEED_CONFIG.jury_size);
    }
    expect(output.items.length).toBeGreaterThan(0);
    for (const r of output.items) {
      expect(r.classification).toBeNull();
      expect(r.groups).toEqual([]);
      expect(r.total_approval).toBeGreaterThanOrEqual(0);
    }
    expect(groups.k).toBe(0);
  });
});

describe("validazione dell'input", () => {
  const base = inputFrom(generatePolarized({ ...BASE_OPTIONS, groupSizes: [5, 5] }));

  it("voto duplicato → errore senza pseudo nel messaggio", () => {
    const dup = base.votes[0] as Vote;
    expect(() => runEngine({ ...base, votes: [...base.votes, dup] })).toThrow(/duplicat/);
    try {
      runEngine({ ...base, votes: [...base.votes, dup] });
    } catch (e) {
      expect(String(e)).not.toContain(dup.pseudo);
    }
  });

  it("valore di voto non valido → errore", () => {
    const bad = { pseudo: "x", item: "y", value: 2 } as unknown as Vote;
    expect(() => runEngine({ ...base, votes: [...base.votes, bad] })).toThrow();
  });

  it("config non valida (k_min > k_max) → errore che cita la chiave", () => {
    expect(() => runEngine({ ...base, config: { ...SEED_CONFIG, k_min: 6 } })).toThrow(/k_min/);
  });
});
