import { describe, expect, it } from "vitest";
import {
  OpinionGroups,
  computeReputation,
  formJuryPanels,
  rngFromSeed,
  stratifiedDraw,
} from "../src/core/index";
import { SEED_CONFIG } from "./fixtures";

/** Mappa pseudo → gruppo con gruppi di dimensioni date: g0-0, g0-1, ..., g1-0, ... */
function makeGroups(sizes: number[]): Map<string, number> {
  const m = new Map<string, number>();
  sizes.forEach((n, g) => {
    for (let i = 0; i < n; i++) m.set(`g${g}-${String(i).padStart(3, "0")}`, g);
  });
  return m;
}

const AT3 = [false, false, false];

describe("formJuryPanels", () => {
  const groupOf = makeGroups([10, 7, 4]);
  const eligible = [...groupOf.keys()];
  const cfg = { jury_size: 5, jury_min_buckets: 3 };

  it("ogni panel ha jury_size membri da ≥ jury_min_buckets gruppi diversi, panel disgiunti", () => {
    const panels = formJuryPanels(groupOf, AT3, eligible, cfg, rngFromSeed("s"));
    // Calcolo a mano (greedy): [10,7,4] → 4 panel, poi restano meno di 3 gruppi non vuoti.
    expect(panels).toHaveLength(4);
    const seen = new Set<string>();
    for (const p of panels) {
      expect(p.members).toHaveLength(cfg.jury_size);
      const groups = new Set(p.members.map((m) => groupOf.get(m)));
      expect(groups.size).toBeGreaterThanOrEqual(cfg.jury_min_buckets);
      for (const m of p.members) {
        expect(seen.has(m)).toBe(false);
        seen.add(m);
      }
    }
  });

  it("output senza etichetta di gruppo: solo panel_id, diversity e membri in ordine alfabetico", () => {
    const panels = formJuryPanels(groupOf, AT3, eligible, cfg, rngFromSeed("s"));
    panels.forEach((p, i) => {
      expect(Object.keys(p).sort()).toEqual(["diversity", "members", "panel_id"]);
      expect(p.diversity).toBe(true);
      expect(p.panel_id).toBe(i + 1);
      expect([...p.members]).toEqual([...p.members].sort());
    });
  });

  it("k < jury_min_buckets (k = 2): panel con membri di min(jury_min_buckets, k) = 2 gruppi", () => {
    const two = makeGroups([20, 20]);
    const panels = formJuryPanels(two, [false, false], [...two.keys()], cfg, rngFromSeed("s"));
    expect(panels).toHaveLength(8);
    for (const p of panels) {
      expect(p.members).toHaveLength(cfg.jury_size);
      expect(new Set(p.members.map((m) => two.get(m))).size).toBe(2);
      expect(p.diversity).toBe(true);
    }
  });

  it("nessun gruppo (run insufficient, k = 0): panel casuali tra gli idonei, diversity false", () => {
    const pool = Array.from({ length: 23 }, (_, i) => `idoneo-${String(i).padStart(2, "0")}`);
    const panels = formJuryPanels(new Map(), [], pool, cfg, rngFromSeed("s"));
    expect(panels).toHaveLength(4); // 23 idonei / 5 = 4 panel, 3 avanzano
    const seen = new Set<string>();
    panels.forEach((p, i) => {
      expect(Object.keys(p).sort()).toEqual(["diversity", "members", "panel_id"]);
      expect(p.panel_id).toBe(i + 1);
      expect(p.diversity).toBe(false);
      expect(p.members).toHaveLength(cfg.jury_size);
      expect([...p.members]).toEqual([...p.members].sort());
      for (const m of p.members) {
        expect(seen.has(m)).toBe(false);
        seen.add(m);
      }
    });
    expect(formJuryPanels(new Map(), [], pool, cfg, rngFromSeed("s"))).toEqual(panels);
    expect(formJuryPanels(new Map(), [], pool, cfg, rngFromSeed("t"))).not.toEqual(panels);
  });

  it("gli idonei senza gruppo possono completare un panel ma non contano per la diversità", () => {
    const panels = formJuryPanels(groupOf, AT3, [...eligible, "senza-gruppo"], cfg, rngFromSeed("s"));
    for (const p of panels) {
      const groups = new Set(p.members.filter((m) => groupOf.has(m)).map((m) => groupOf.get(m)));
      expect(groups.size).toBeGreaterThanOrEqual(cfg.jury_min_buckets);
    }
  });

  it("k = 3 ma idonei in 2 soli gruppi → panel prodotti con ≥ 2 gruppi", () => {
    const onlyTwo = eligible.filter((m) => groupOf.get(m) !== 2);
    const panels = formJuryPanels(groupOf, AT3, onlyTwo, cfg, rngFromSeed("s"));
    expect(panels.length).toBe(Math.floor(onlyTwo.length / cfg.jury_size));
    for (const p of panels) {
      expect(p.diversity).toBe(true);
      expect(new Set(p.members.map((m) => groupOf.get(m))).size).toBeGreaterThanOrEqual(2);
    }
  });

  it("giurati idonei in un solo gruppo (gli altri troppo giovani) → panel casuali, diversity false", () => {
    const onlyOne = eligible.filter((m) => groupOf.get(m) === 0);
    const panels = formJuryPanels(groupOf, AT3, onlyOne, cfg, rngFromSeed("s"));
    expect(panels).toHaveLength(2);
    for (const p of panels) expect(p.diversity).toBe(false);
  });

  it("i gruppi sotto quota completano i panel ma non contano come bucket", () => {
    const g = makeGroups([10, 10, 3]);
    const panels = formJuryPanels(g, [false, false, true], [...g.keys()], cfg, rngFromSeed("s"));
    // bucket a quota = 2 → min(3, 2) = 2
    expect(panels).toHaveLength(4);
    for (const p of panels) {
      expect(p.diversity).toBe(true);
      const atShare = new Set(p.members.map((m) => g.get(m)).filter((x) => x !== 2));
      expect(atShare.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("nessun bucket a quota con idonei → panel casuali tra tutti gli idonei", () => {
    const g = makeGroups([10, 10, 6]);
    const pool = [...[...g.keys()].filter((m) => g.get(m) === 2), "x1", "x2", "x3", "x4"];
    const panels = formJuryPanels(g, [false, false, true], pool, cfg, rngFromSeed("s"));
    expect(panels).toHaveLength(2);
    for (const p of panels) expect(p.diversity).toBe(false);
  });

  it("mai zero panel con ≥ jury_size idonei: 2 bucket da 1 idoneo + 3 senza gruppo → 1 panel", () => {
    const pool = ["g0-000", "g1-000", "x1", "x2", "x3"];
    const panels = formJuryPanels(groupOf, AT3, pool, cfg, rngFromSeed("s"));
    expect(panels).toHaveLength(1);
    expect(panels[0]?.members).toEqual([...pool].sort());
    expect(panels[0]?.diversity).toBe(true);
  });

  it("deterministico con lo stesso seed", () => {
    expect(formJuryPanels(groupOf, AT3, eligible, cfg, rngFromSeed("a"))).toEqual(
      formJuryPanels(groupOf, AT3, [...eligible].reverse(), cfg, rngFromSeed("a")),
    );
  });
});

describe("stratifiedDraw", () => {
  const groupOf = makeGroups([60, 30, 10]);
  const eligible = [...groupOf.keys()];

  it("quote proporzionali ai gruppi (60/30/10 su 10 → 6/3/1)", () => {
    const drawn = stratifiedDraw(groupOf, eligible, rngFromSeed("seed"), 10);
    expect(drawn).toHaveLength(10);
    const per = [0, 0, 0];
    for (const p of drawn) per[groupOf.get(p)!]!++;
    expect(per).toEqual([6, 3, 1]);
    expect([...drawn]).toEqual([...drawn].sort());
  });

  it("chi non ha gruppo forma uno strato a parte e non viene escluso", () => {
    const extra = Array.from({ length: 100 }, (_, i) => `x-${i}`);
    const drawn = stratifiedDraw(groupOf, [...eligible, ...extra], rngFromSeed("seed"), 10);
    expect(drawn.filter((p) => p.startsWith("x-"))).toHaveLength(5);
  });

  it("count ≥ idonei → tutti", () => {
    expect(stratifiedDraw(groupOf, ["g0-000", "g1-000"], rngFromSeed("s"), 7)).toEqual(["g0-000", "g1-000"]);
  });

  it("stesso seed → stesso sorteggio; seed diverso → sorteggio diverso", () => {
    const a = stratifiedDraw(groupOf, eligible, rngFromSeed("seed-1"), 7);
    expect(stratifiedDraw(groupOf, [...eligible].reverse(), rngFromSeed("seed-1"), 7)).toEqual(a);
    expect(stratifiedDraw(groupOf, eligible, rngFromSeed("seed-2"), 7)).not.toEqual(a);
  });
});

describe("computeReputation (valori calcolati a mano, half-life 90 giorni)", () => {
  const groupOf = new Map([
    ["autA", 0],
    ["r0", 0],
    ["r1", 1],
    ["autB", 1],
  ]);
  // partecipanti idonei al calcolo (età e voti minimi): nel caso clustered coincidono con chi ha un gruppo
  const participants = new Set(groupOf.keys());
  const cfg = {
    reputation_half_life_days: SEED_CONFIG.reputation_half_life_days,
    reputation_cross_credit: SEED_CONFIG.reputation_cross_credit,
    reputation_same_credit: SEED_CONFIG.reputation_same_credit,
  };

  it("cross_credit da gruppo diverso, same_credit dallo stesso gruppo o con autore senza gruppo, decadimento esponenziale", () => {
    const rep = computeReputation(
      [
        { author: "autA", rater: "r1", age_days: 0 }, // 1
        { author: "autA", rater: "r0", age_days: 0 }, // 0,25
        { author: "autA", rater: "r1", age_days: 90 }, // 0,5
        { author: "autA", rater: "r0", age_days: 180 }, // 0,0625
        { author: "autA", rater: "autA", age_days: 0 }, // 0: sé stessi
        { author: "autB", rater: "r0", age_days: 0 }, // 1
        { author: "autB", rater: "non-idoneo", age_days: 0 }, // 0: votante non idoneo
        { author: "nuovo", rater: "r1", age_days: 0 }, // autore senza gruppo → 0,25
        { author: "solo-brigata", rater: "non-idoneo", age_days: 0 }, // 0 → assente
      ],
      groupOf,
      [false, false],
      participants,
      cfg,
    );
    expect(rep).toEqual([
      { pseudo: "autA", score: expect.closeTo(1 + 0.25 + 0.5 + 0.0625, 10) },
      { pseudo: "autB", score: expect.closeTo(1, 10) },
      { pseudo: "nuovo", score: expect.closeTo(0.25, 10) },
    ]);
  });

  it("i crediti vengono dalla config, non dal codice", () => {
    const rep = computeReputation(
      [
        { author: "autA", rater: "r1", age_days: 0 },
        { author: "autA", rater: "r0", age_days: 0 },
      ],
      groupOf,
      [false, false],
      participants,
      { ...cfg, reputation_cross_credit: 3, reputation_same_credit: 0.5 },
    );
    expect(rep).toEqual([{ pseudo: "autA", score: expect.closeTo(3.5, 10) }]);
  });

  it("un blocco sotto quota che dà \"utile\" a un complice gli dà al massimo il credito same", () => {
    const g = new Map([...groupOf, ["blk1", 2], ["blk2", 2], ["blk3", 2]]);
    const rep = computeReputation(
      [
        { author: "autA", rater: "blk1", age_days: 0 },
        { author: "autA", rater: "blk2", age_days: 0 },
        { author: "autA", rater: "blk3", age_days: 0 },
        { author: "blk1", rater: "r1", age_days: 0 }, // autore sotto quota, votante a quota: same
      ],
      g,
      [false, false, true],
      new Set(g.keys()),
      cfg,
    );
    expect(rep).toEqual([
      { pseudo: "autA", score: expect.closeTo(3 * 0.25, 10) },
      { pseudo: "blk1", score: expect.closeTo(0.25, 10) },
    ]);
  });

  it("senza gruppi (run insufficient): votante idoneo → same_credit, non idoneo → 0", () => {
    const rep = computeReputation(
      [
        { author: "x", rater: "r0", age_days: 0 },
        { author: "x", rater: "nuovo-account", age_days: 0 },
      ],
      new Map(),
      [],
      new Set(["r0"]),
      cfg,
    );
    expect(rep).toEqual([{ pseudo: "x", score: expect.closeTo(0.25, 10) }]);
  });
});

describe("OpinionGroups (gruppi solo in memoria)", () => {
  const groupOf = makeGroups([10, 7, 4]);
  const groups = new OpinionGroups(groupOf, 3);

  it("la serializzazione non contiene pseudo né assegnazioni", () => {
    const json = JSON.stringify(groups);
    expect(json).not.toContain("g0-000");
    expect(JSON.parse(json)).toEqual({ k: 3 });
  });

  it("non espone la mappa pseudo → gruppo", () => {
    expect(Object.keys(groups)).toEqual(["k"]);
    expect(Object.values(groups)).toEqual([3]);
  });

  it("espone solo drawStratified (i panel giuria stanno in output.private)", () => {
    const methods = Object.getOwnPropertyNames(OpinionGroups.prototype).filter((m) => m !== "constructor").sort();
    expect(methods).toEqual(["drawStratified", "toJSON"]);
  });

  it("drawStratified(eligible, seed, count) usa i gruppi in memoria", () => {
    const eligible = [...groupOf.keys()];
    expect(groups.drawStratified(eligible, "abc", 5)).toEqual(
      stratifiedDraw(groupOf, eligible, rngFromSeed("abc"), 5),
    );
  });
});
