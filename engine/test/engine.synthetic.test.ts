import { describe, expect, it } from "vitest";
import { buildCenteredMatrix, chooseK, project2D, rngFromSeed, runEngine, selectEligible } from "../src/core/index";
import type { EngineInput, ReputationEvent, Vote } from "../src/core/index";
import { SEED_CONFIG } from "./fixtures";
import { BASE_OPTIONS, generateExact, generatePolarized, type ExactItem, type SyntheticData } from "./synthetic";

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

/**
 * Ricostruisce la partizione della run con le stesse funzioni pure e lo stesso seed:
 * il motore non la espone, il test la ricalcola per verificare i panel.
 */
function partitionOf(input: EngineInput): Map<string, number> {
  const { participants, items } = selectEligible(input.votes, input.account_age_days, input.config);
  const points = project2D(buildCenteredMatrix(input.votes, participants, items).centered);
  const best = chooseK(points, input.config.k_min, input.config.k_max, rngFromSeed(`${input.seed}:kmeans`))!;
  return new Map(participants.map((p, i) => [p, best.assignments[i] as number]));
}

/** 50 account che votano in blocco: contro gli item trasversali, a favore di tutti i polarizzati. */
function brigade(data: SyntheticData, ageDays: number, prefix = "brig") {
  const votes: Vote[] = [];
  const ages: Record<string, number> = {};
  for (let i = 0; i < 50; i++) {
    const pseudo = `${prefix}-${i}`;
    ages[pseudo] = ageDays;
    for (const item of data.bridges) votes.push({ pseudo, item, value: -1 });
    for (const item of data.polarized) votes.push({ pseudo, item, value: 1 });
    votes.push({ pseudo, item: "solo-brigata", value: 1 });
  }
  return { votes, ages };
}

describe("E1.4 — 2 gruppi polarizzati (200 utenti) + 5 item trasversali", () => {
  const data = generatePolarized(BASE_OPTIONS);
  const { output } = runEngine(inputFrom(data));
  const pub = output.public;

  it("trova 2 gruppi di dimensione simile", () => {
    expect(pub.outcome).toBe("clustered");
    expect(pub.k).toBe(2);
    expect(pub.clusters.map((c) => c.label)).toEqual(["Gruppo 1", "Gruppo 2"]);
    expect(pub.clusters.reduce((s, c) => s + c.size, 0)).toBe(pub.participants);
    for (const c of pub.clusters) expect(c.size).toBeGreaterThanOrEqual(90);
  });

  it("gli item trasversali sono ponte", () => {
    for (const item of data.bridges) {
      expect(pub.items.find((x) => x.item === item)?.classification, item).toBe("ponte");
    }
  });

  it("gli item polarizzati sono divisivi", () => {
    for (const item of data.polarized) {
      expect(pub.items.find((x) => x.item === item)?.classification, item).toBe("divisivo");
    }
  });

  it("k = 2 < jury_min_buckets: panel con membri di entrambi i gruppi, diversity true", () => {
    const panels = runEngine(inputFrom(data, { jury_eligible: [...data.truth.keys()] })).output.private.jury_panels;
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) {
      expect(p.members).toHaveLength(SEED_CONFIG.jury_size);
      expect(new Set(p.members.map((m) => data.truth.get(m))).size).toBe(2);
      expect(p.diversity).toBe(true);
    }
  });

  it("stable_ponte solo con lo storico: ponte anche nella run precedente; 'assente' rompe la serie", () => {
    const ponte = Object.fromEntries(data.bridges.map((b) => [b, ["ponte" as const]]));
    const broken = Object.fromEntries(data.bridges.map((b) => [b, ["ponte" as const, "assente" as const]]));
    const withHistory = runEngine(inputFrom(data, { history: ponte })).output.public;
    const withGap = runEngine(inputFrom(data, { history: broken })).output.public;
    for (const item of data.bridges) {
      expect(pub.items.find((x) => x.item === item)?.stable_ponte).toBe(false);
      expect(withHistory.items.find((x) => x.item === item)?.stable_ponte).toBe(true);
      expect(withGap.items.find((x) => x.item === item)?.stable_ponte).toBe(false);
    }
  });
});

describe("E1.4 — gruppi 150/50 a conteggi esatti (valori calcolati a mano)", () => {
  // 12 item polarizzati per far emergere i gruppi, poi item costruiti vicino alle soglie.
  const polarized: ExactItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: `pol-${i}`,
    perGroup: i % 2 === 0 ? [[140, 10, 0], [3, 47, 0]] : [[10, 140, 0], [47, 3, 0]],
  }));
  const probes: ExactItem[] = [
    // g1 121/152 = 0,796; g2 23/52 = 0,442; gap 0,354; totale 142/200 = 0,71
    { id: "solo-gruppo-grande", perGroup: [[120, 30, 0], [22, 28, 0]] },
    // g1 92/152 = 0,6053; g2 32/52 = 0,6154 → min ≥ 0,6
    { id: "soglia-sopra", perGroup: [[91, 59, 0], [31, 19, 0]] },
    // g1 0,6053; g2 31/52 = 0,5962 → non ponte; totale 121/200 = 0,605
    { id: "soglia-sotto", perGroup: [[91, 59, 0], [30, 20, 0]] },
    // g1 76/152 = 0,5; g2 26/52 = 0,5; totale 0,5
    { id: "nessun-consenso", perGroup: [[75, 75, 0], [25, 25, 0]] },
    // g1 131/152 = 0,8618; g2 24/52 = 0,4615; gap 0,4003
    { id: "divisivo-soglia", perGroup: [[130, 20, 0], [23, 27, 0]] },
    // g2 25/52 = 0,4808; gap 0,381 → non divisivo; totale 154/200 = 0,77
    { id: "divisivo-sotto", perGroup: [[130, 20, 0], [24, 26, 0]] },
  ];
  const data = generateExact("esatti-150-50", [150, 50], [...polarized, ...probes]);
  const pub = runEngine(inputFrom(data)).output.public;
  const item = (id: string) => pub.items.find((x) => x.item === id)!;

  it("i cluster coincidono con i gruppi veri (150 e 50)", () => {
    expect(pub.k).toBe(2);
    expect(pub.clusters).toEqual([
      { label: "Gruppo 1", size: 150, below_share: false },
      { label: "Gruppo 2", size: 50, below_share: false },
    ]);
  });

  it("approvato solo dal gruppo grande → maggioritario, non ponte", () => {
    const r = item("solo-gruppo-grande");
    expect(r.groups[0]?.p_agree).toBeCloseTo(121 / 152, 10);
    expect(r.groups[1]?.p_agree).toBeCloseTo(23 / 52, 10);
    expect(r.total_approval).toBeCloseTo(0.71, 10);
    expect(r.classification).toBe("maggioritario");
  });

  it("vicino alla soglia di ponte: appena sopra → ponte, appena sotto → maggioritario", () => {
    expect(item("soglia-sopra").bridging_score).toBeCloseTo(92 / 152, 10);
    expect(item("soglia-sopra").classification).toBe("ponte");
    expect(item("soglia-sotto").bridging_score).toBeCloseTo(31 / 52, 10);
    expect(item("soglia-sotto").classification).toBe("maggioritario");
  });

  it("vicino alla soglia di divisività: appena sopra → divisivo, appena sotto → maggioritario", () => {
    expect(item("divisivo-soglia").classification).toBe("divisivo");
    expect(item("divisivo-sotto").classification).toBe("maggioritario");
  });

  it("gruppo esattamente a quota (50 su 200 con min_cluster_share 0,25) conta; appena sopra la quota no", () => {
    const at = runEngine(inputFrom(data, { config: { ...SEED_CONFIG, min_cluster_share: 0.25 } })).output.public;
    expect(at.clusters.map((c) => c.below_share)).toEqual([false, false]);
    expect(at.items.find((x) => x.item === "solo-gruppo-grande")?.classification).toBe("maggioritario");
    const above = runEngine(inputFrom(data, { config: { ...SEED_CONFIG, min_cluster_share: 0.26 } })).output.public;
    expect(above.clusters.map((c) => c.below_share)).toEqual([false, true]);
    // senza il gruppo piccolo resta solo il Gruppo 1: 121/152 ≥ 0,6 → ponte
    const r = above.items.find((x) => x.item === "solo-gruppo-grande")!;
    expect(r.groups[1]?.below_share).toBe(true);
    expect(r.bridging_score).toBeCloseTo(121 / 152, 10);
    expect(r.classification).toBe("ponte");
  });

  it("nessun_consenso su dati sintetici", () => {
    expect(item("nessun-consenso").bridging_score).toBeCloseTo(0.5, 10);
    expect(item("nessun-consenso").classification).toBe("nessun_consenso");
  });
});

describe("E1.4 — brigading", () => {
  const data = generatePolarized(BASE_OPTIONS);
  const young = brigade(data, SEED_CONFIG.min_account_age_days_for_engine - 1);
  const clean = runEngine(inputFrom(data)).output;
  const attacked = runEngine(
    inputFrom(data, { votes: [...data.votes, ...young.votes], account_age_days: { ...data.ages, ...young.ages } }),
  ).output;

  it("50 account più giovani di min_account_age_days_for_engine non cambiano nessuna classificazione", () => {
    expect(classifications(attacked.public.items)).toEqual(classifications(clean.public.items));
  });

  it("l'output è identico: gli account esclusi non entrano nel calcolo", () => {
    expect(attacked).toEqual(clean);
    expect(attacked.public.items.some((r) => r.item === "solo-brigata")).toBe(false);
  });

  it('50 account nuovi (e 10 senza voti) che danno "utile" in blocco non cambiano la reputazione di nessuno', () => {
    const authors = [...data.truth.keys()].slice(0, 20);
    const honest: ReputationEvent[] = authors.map((author, i) => ({
      author,
      rater: authors[(i + 1) % authors.length] as string,
      age_days: i,
    }));
    const lurkers: Record<string, number> = {};
    for (let i = 0; i < 10; i++) lurkers[`lurker-${i}`] = 365; // account vecchi ma con meno di min_votes_participant voti
    const raters = [...Object.keys(young.ages), ...Object.keys(lurkers)];
    const attack = raters.flatMap((rater) =>
      [...authors.slice(0, 3), "autore-della-brigata"].map((author) => ({ author, rater, age_days: 0 })),
    );
    const cleanRep = runEngine(inputFrom(data, { reputation_events: honest })).output.private.reputation;
    const attackedRep = runEngine(
      inputFrom(data, {
        votes: [...data.votes, ...young.votes],
        account_age_days: { ...data.ages, ...young.ages, ...lurkers },
        reputation_events: [...honest, ...attack],
      }),
    ).output.private.reputation;
    expect(cleanRep.length).toBeGreaterThan(0);
    expect(attackedRep).toEqual(cleanRep);
  });

  it("VOLUTO: 50 account appena sopra l'età su 250 (20% ≥ min_cluster_share) sono una minoranza ampia e il loro veto conta", () => {
    const old = brigade(data, SEED_CONFIG.min_account_age_days_for_engine, "vecchi");
    const pub = runEngine(
      inputFrom(data, { votes: [...data.votes, ...old.votes], account_age_days: { ...data.ages, ...old.ages } }),
    ).output.public;
    // Il blocco entra nel calcolo e diventa un gruppo (k = 3) a quota: votando contro porta il
    // minimo sotto bridging_threshold. È il comportamento voluto: una minoranza ampia conta.
    expect(pub.k).toBe(3);
    const small = pub.clusters.find((c) => c.size === 50);
    expect(small?.below_share).toBe(false);
    for (const b of data.bridges) {
      expect(pub.items.find((x) => x.item === b)?.classification, b).toBe("divisivo");
    }
  });

  it("50 account appena sopra l'età su 1000 utenti onesti (< min_cluster_share): i 5 trasversali restano ponte", () => {
    const big = generatePolarized({ ...BASE_OPTIONS, seed: "grande", groupSizes: [500, 500] });
    const old = brigade(big, SEED_CONFIG.min_account_age_days_for_engine, "vecchi");
    const pub = runEngine(
      inputFrom(big, { votes: [...big.votes, ...old.votes], account_age_days: { ...big.ages, ...old.ages } }),
    ).output.public;
    expect(pub.participants).toBeGreaterThan(1000);
    for (const b of big.bridges) {
      expect(pub.items.find((x) => x.item === b)?.classification, b).toBe("ponte");
    }
    // se il blocco forma un gruppo proprio, è visibile ma marcato sotto quota
    for (const c of pub.clusters) {
      expect(c.below_share).toBe(c.size < SEED_CONFIG.min_cluster_share * pub.participants);
    }
  });

  it("account idonei con voti solo su item poco votati non creano un gruppo né rendono insufficienti gli item principali", () => {
    // 30 account vecchi, 8 voti a testa su 60 item "di nicchia": ogni item di nicchia ha 4 voti (< min_votes_item).
    const niche: Vote[] = [];
    const nicheAges: Record<string, number> = {};
    for (let j = 0; j < 30; j++) {
      const pseudo = `nicchia-${j}`;
      nicheAges[pseudo] = 365;
      for (let t = 0; t < 8; t++) niche.push({ pseudo, item: `nicchia-item-${(j * 8 + t) % 60}`, value: 1 });
    }
    const out = runEngine(
      inputFrom(data, { votes: [...data.votes, ...niche], account_age_days: { ...data.ages, ...nicheAges } }),
    ).output.public;
    expect(out).toEqual(clean.public);
    for (const b of data.bridges) expect(out.items.find((x) => x.item === b)?.classification).toBe("ponte");
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
    const a = runEngine(base).output.private.jury_panels;
    const b = runEngine({ ...base, seed: "altro-seed" }).output.private.jury_panels;
    expect(a.length).toBeGreaterThan(0);
    expect(b).not.toEqual(a);
  });

  it("3 gruppi: i cluster coincidono con i gruppi veri per ≥ 95% dei partecipanti", () => {
    expect(runEngine(base).output.public.k).toBe(3);
    const partition = partitionOf(base);
    const agree = new Map<string, number>();
    for (const [p, c] of partition) {
      const key = `${data.truth.get(p)}-${c}`;
      agree.set(key, (agree.get(key) ?? 0) + 1);
    }
    const majority = [...agree.values()].sort((a, b) => b - a).slice(0, 3).reduce((s, x) => s + x, 0);
    expect(majority / partition.size).toBeGreaterThanOrEqual(0.95);
  });

  it("3 gruppi: ogni panel ha jury_size membri da ≥ min(jury_min_buckets, k) gruppi della run", () => {
    const { output } = runEngine(base);
    const partition = partitionOf(base);
    const k = output.public.k ?? 0;
    expect(output.private.jury_panels.length).toBeGreaterThan(0);
    for (const p of output.private.jury_panels) {
      expect(p.members).toHaveLength(SEED_CONFIG.jury_size);
      expect(p.diversity).toBe(true);
      const groups = new Set(p.members.map((m) => partition.get(m)));
      expect(groups.has(undefined)).toBe(false);
      expect(groups.size).toBeGreaterThanOrEqual(Math.min(SEED_CONFIG.jury_min_buckets, k));
    }
  });

  it("tutti i gruppi sotto quota (3 gruppi da ~1/3 con min_cluster_share 0,45) → insufficient", () => {
    const pub = runEngine({ ...base, config: { ...SEED_CONFIG, min_cluster_share: 0.45 } }).output.public;
    expect(pub.outcome).toBe("insufficient");
    expect(pub.insufficient_reason).toBe("all_groups_below_share");
    expect(pub.clusters).toEqual([]);
  });

  it("drawStratified sui gruppi della run è proporzionale ai gruppi veri", () => {
    const { groups } = runEngine(base);
    const drawn = groups.drawStratified(eligible, "sha256-di-esempio", 9);
    const per = [0, 0, 0];
    for (const p of drawn) per[data.truth.get(p)!]!++;
    expect(per).toEqual([3, 3, 3]);
  });
});

describe("E1.4 — esiti insufficient", () => {
  it("too_few_participants: sole approvazioni totali, panel casuali con diversity false", () => {
    const data = generatePolarized({ ...BASE_OPTIONS, groupSizes: [20, 20] });
    const { output, groups } = runEngine(inputFrom(data, { jury_eligible: [...data.truth.keys()] }));
    const pub = output.public;
    expect(pub.participants).toBeLessThan(SEED_CONFIG.min_participants_for_clustering);
    expect(pub.outcome).toBe("insufficient");
    expect(pub.insufficient_reason).toBe("too_few_participants");
    expect(pub.k).toBeNull();
    expect(pub.silhouette).toBeNull();
    expect(pub.clusters).toEqual([]);
    expect(output.private.jury_panels).toHaveLength(Math.floor(data.truth.size / SEED_CONFIG.jury_size));
    for (const p of output.private.jury_panels) {
      expect(p.diversity).toBe(false);
      expect(p.members).toHaveLength(SEED_CONFIG.jury_size);
    }
    expect(pub.items.length).toBeGreaterThan(0);
    for (const r of pub.items) {
      expect(r.classification).toBeNull();
      expect(r.groups).toEqual([]);
    }
    expect(groups.k).toBe(0);
  });

  it("no_items: nessun item raggiunge min_votes_item", () => {
    const votes: Vote[] = [];
    const ages: Record<string, number> = {};
    for (let u = 0; u < 60; u++) {
      ages[`u-${u}`] = 30;
      for (let t = 0; t < 8; t++) votes.push({ pseudo: `u-${u}`, item: `item-${u}-${t}`, value: 1 });
    }
    const pub = runEngine({ ...inputFrom({ votes, ages, truth: new Map(), polarized: [], bridges: [] }) }).output.public;
    expect(pub.outcome).toBe("insufficient");
    expect(pub.insufficient_reason).toBe("no_items");
    expect(pub.items).toEqual([]);
  });

  it("no_structure: tutti votano allo stesso modo, la proiezione non ha struttura", () => {
    const votes: Vote[] = [];
    const ages: Record<string, number> = {};
    for (let u = 0; u < 60; u++) {
      ages[`u-${u}`] = 30;
      for (let t = 0; t < 8; t++) votes.push({ pseudo: `u-${u}`, item: `item-${t}`, value: 1 });
    }
    const pub = runEngine(inputFrom({ votes, ages, truth: new Map(), polarized: [], bridges: [] })).output.public;
    expect(pub.outcome).toBe("insufficient");
    expect(pub.insufficient_reason).toBe("no_structure");
    expect(pub.participants).toBe(60);
    for (const r of pub.items) expect(r.total_approval).toBe(1);
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

  it("min_cluster_share fuori da [0, 0,5) → errore che cita la chiave", () => {
    for (const v of [-0.1, 0.5, 0.7, Number.NaN]) {
      expect(() => runEngine({ ...base, config: { ...SEED_CONFIG, min_cluster_share: v } })).toThrow(/min_cluster_share/);
    }
    expect(() => runEngine({ ...base, config: { ...SEED_CONFIG, min_cluster_share: 0 } })).not.toThrow();
  });

  it("config non valida (k_min > k_max) → errore che cita la chiave", () => {
    expect(() => runEngine({ ...base, config: { ...SEED_CONFIG, k_min: 6 } })).toThrow(/k_min/);
  });

  it("età account NaN o negativa → errore senza pseudo nel messaggio", () => {
    for (const age of [Number.NaN, -1]) {
      const input = { ...base, account_age_days: { ...base.account_age_days, "pseudo-x": age } };
      expect(() => runEngine(input)).toThrow(/account_age_days/);
      expect(() => runEngine(input)).not.toThrow(/pseudo-x/);
    }
  });

  it("eventi di reputazione con campi non validi → errore", () => {
    const ok: ReputationEvent = { author: "a", rater: "b", age_days: 1 };
    const bad: ReputationEvent[] = [
      { ...ok, age_days: Number.NaN },
      { ...ok, age_days: -3 },
      { ...ok, age_days: Number.POSITIVE_INFINITY },
      { ...ok, author: "" },
      { ...ok, rater: "" },
      { ...ok, author: 5 as unknown as string },
    ];
    expect(() => runEngine({ ...base, reputation_events: [ok] })).not.toThrow();
    for (const e of bad) expect(() => runEngine({ ...base, reputation_events: [e] })).toThrow(/reputation_events/);
  });
});
