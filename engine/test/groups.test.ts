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

describe("formJuryPanels", () => {
  const groupOf = makeGroups([10, 7, 4]);
  const eligible = [...groupOf.keys()];
  const cfg = { jury_size: 5, jury_min_buckets: 3 };

  it("ogni panel ha jury_size membri da ≥ jury_min_buckets gruppi diversi, panel disgiunti", () => {
    const panels = formJuryPanels(groupOf, eligible, cfg, rngFromSeed("s"));
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

  it("output senza etichetta di gruppo: solo panel_id e membri in ordine alfabetico", () => {
    const panels = formJuryPanels(groupOf, eligible, cfg, rngFromSeed("s"));
    panels.forEach((p, i) => {
      expect(Object.keys(p).sort()).toEqual(["members", "panel_id"]);
      expect(p.panel_id).toBe(i + 1);
      expect([...p.members]).toEqual([...p.members].sort());
    });
  });

  it("nessun panel se i gruppi sono meno di jury_min_buckets", () => {
    const two = makeGroups([20, 20]);
    expect(formJuryPanels(two, [...two.keys()], cfg, rngFromSeed("s"))).toEqual([]);
  });

  it("esclude gli idonei che non hanno un gruppo (non partecipanti al calcolo)", () => {
    const panels = formJuryPanels(groupOf, [...eligible, "senza-gruppo"], cfg, rngFromSeed("s"));
    for (const p of panels) expect(p.members).not.toContain("senza-gruppo");
  });

  it("deterministico con lo stesso seed", () => {
    expect(formJuryPanels(groupOf, eligible, cfg, rngFromSeed("a"))).toEqual(
      formJuryPanels(groupOf, [...eligible].reverse(), cfg, rngFromSeed("a")),
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
  const cfg = { reputation_half_life_days: SEED_CONFIG.reputation_half_life_days };

  it("1 da gruppo diverso, 0,25 dallo stesso gruppo o da chi non ha gruppo, 0 a sé stessi, decadimento esponenziale", () => {
    const rep = computeReputation(
      [
        { author: "autA", rater: "r1", age_days: 0 }, // 1
        { author: "autA", rater: "r0", age_days: 0 }, // 0,25
        { author: "autA", rater: "r1", age_days: 90 }, // 0,5
        { author: "autA", rater: "r0", age_days: 180 }, // 0,0625
        { author: "autA", rater: "autA", age_days: 0 }, // 0
        { author: "autB", rater: "sconosciuto", age_days: 0 }, // 0,25
        { author: "nuovo", rater: "r1", age_days: 0 }, // autore senza gruppo → 0,25
      ],
      groupOf,
      cfg,
    );
    expect(rep).toEqual([
      { pseudo: "autA", score: expect.closeTo(1 + 0.25 + 0.5 + 0.0625, 10) },
      { pseudo: "autB", score: expect.closeTo(0.25, 10) },
      { pseudo: "nuovo", score: expect.closeTo(0.25, 10) },
    ]);
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

  it("drawStratified(eligible, seed, count) usa i gruppi in memoria", () => {
    const eligible = [...groupOf.keys()];
    expect(groups.drawStratified(eligible, "abc", 5)).toEqual(
      stratifiedDraw(groupOf, eligible, rngFromSeed("abc"), 5),
    );
  });
});
