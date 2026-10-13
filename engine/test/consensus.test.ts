import { describe, expect, it } from "vitest";
import { classify, computeItemResults, groupLabel, isStablePonte, pAgree } from "../src/core/index";
import type { Vote, VoteValue } from "../src/core/index";
import { SEED_CONFIG } from "./fixtures";

describe("pAgree", () => {
  it("(agree+1)/(agree+disagree+pass+2)", () => {
    expect(pAgree(3, 0, 0)).toBeCloseTo(4 / 5);
    expect(pAgree(2, 0, 1)).toBeCloseTo(3 / 5);
    expect(pAgree(0, 3, 0)).toBeCloseTo(1 / 5);
    expect(pAgree(0, 0, 0)).toBeCloseTo(1 / 2);
  });
});

describe("groupLabel", () => {
  it("numera da 1", () => {
    expect(groupLabel(0)).toBe("Gruppo 1");
    expect(groupLabel(2)).toBe("Gruppo 3");
  });
});

describe("classify", () => {
  const cfg = SEED_CONFIG; // bridging 0.6, divisive_gap 0.4, majority 0.6
  it("ponte se il minimo tra i gruppi ≥ bridging_threshold (ha la precedenza)", () => {
    expect(classify([0.6, 1.0], 0.8, cfg)).toEqual({ bridging_score: 0.6, classification: "ponte" });
  });
  it("divisivo se max - min ≥ divisive_gap", () => {
    expect(classify([0.9, 0.2], 0.55, cfg)).toEqual({ bridging_score: 0.2, classification: "divisivo" });
  });
  it("maggioritario se l'approvazione totale ≥ majority_threshold", () => {
    expect(classify([0.5, 0.55], 0.7, cfg)).toEqual({ bridging_score: 0.5, classification: "maggioritario" });
  });
  it("nessun_consenso altrimenti", () => {
    expect(classify([0.5, 0.55], 0.5, cfg)).toEqual({ bridging_score: 0.5, classification: "nessun_consenso" });
  });
  it("insufficiente se un gruppo non ha abbastanza voti", () => {
    expect(classify([0.9, null], 0.9, cfg)).toEqual({ bridging_score: null, classification: "insufficiente" });
  });
});

describe("isStablePonte", () => {
  it("ponte nelle ultime bridging_stable_runs run, compresa la corrente", () => {
    expect(isStablePonte("ponte", ["ponte"], 2)).toBe(true);
    expect(isStablePonte("ponte", ["divisivo", "ponte"], 2)).toBe(true);
    expect(isStablePonte("ponte", ["ponte", "divisivo"], 2)).toBe(false);
    expect(isStablePonte("ponte", [], 2)).toBe(false);
    expect(isStablePonte("divisivo", ["ponte"], 2)).toBe(false);
    expect(isStablePonte("ponte", [], 1)).toBe(true);
    expect(isStablePonte(null, ["ponte"], 2)).toBe(false);
  });
});

describe("computeItemResults (valori calcolati a mano)", () => {
  // Gruppo 1: a, b, c — Gruppo 2: d, e, f
  const groupOf = new Map([
    ["a", 0],
    ["b", 0],
    ["c", 0],
    ["d", 1],
    ["e", 1],
    ["f", 1],
  ]);
  const v = (pseudo: string, item: string, value: VoteValue): Vote => ({ pseudo, item, value });
  const votes: Vote[] = [
    // X: g1 3 sì → 4/5 = 0,8; g2 2 sì + 1 passo → 3/5 = 0,6 → ponte (min 0,6)
    v("a", "X", 1), v("b", "X", 1), v("c", "X", 1), v("d", "X", 1), v("e", "X", 1), v("f", "X", 0),
    // Y: g1 0,8; g2 3 no → 1/5 = 0,2 → divisivo
    v("a", "Y", 1), v("b", "Y", 1), v("c", "Y", 1), v("d", "Y", -1), v("e", "Y", -1), v("f", "Y", -1),
    // W: g1 solo 2 voti (< min_votes_per_cluster = 3) → insufficiente
    v("a", "W", 1), v("b", "W", 1), v("d", "W", 1), v("e", "W", 1), v("f", "W", 1),
    // voto di un non partecipante: ignorato
    v("zzz", "X", -1),
  ];
  const participants = new Set(groupOf.keys());
  const results = computeItemResults(votes, participants, ["W", "X", "Y"], groupOf, 2, { X: ["ponte"] }, SEED_CONFIG);
  const byItem = new Map(results.map((r) => [r.item, r]));

  it("X è ponte, stabile perché era ponte anche nella run precedente", () => {
    const x = byItem.get("X")!;
    expect(x.votes).toBe(6);
    expect(x.agree).toBe(5);
    expect(x.pass).toBe(1);
    expect(x.disagree).toBe(0);
    expect(x.total_approval).toBeCloseTo(5 / 6);
    expect(x.groups).toEqual([
      { group: "Gruppo 1", p_agree: 0.8 },
      { group: "Gruppo 2", p_agree: 0.6 },
    ]);
    expect(x.bridging_score).toBeCloseTo(0.6);
    expect(x.classification).toBe("ponte");
    expect(x.stable_ponte).toBe(true);
  });

  it("Y è divisivo", () => {
    const y = byItem.get("Y")!;
    expect(y.total_approval).toBeCloseTo(0.5);
    expect(y.groups[1]?.p_agree).toBeCloseTo(0.2);
    expect(y.bridging_score).toBeCloseTo(0.2);
    expect(y.classification).toBe("divisivo");
    expect(y.stable_ponte).toBe(false);
  });

  it("W è insufficiente: gruppo con meno di min_votes_per_cluster voti", () => {
    const w = byItem.get("W")!;
    expect(w.groups[0]?.p_agree).toBeNull();
    expect(w.bridging_score).toBeNull();
    expect(w.classification).toBe("insufficiente");
  });

  it("senza gruppi (k = 0): solo approvazioni totali, nessuna classificazione", () => {
    const r = computeItemResults(votes, participants, ["X"], new Map(), 0, {}, SEED_CONFIG);
    expect(r[0]?.groups).toEqual([]);
    expect(r[0]?.classification).toBeNull();
    expect(r[0]?.bridging_score).toBeNull();
    expect(r[0]?.total_approval).toBeCloseTo(5 / 6);
  });
});
