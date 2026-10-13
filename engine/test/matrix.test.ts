import { describe, expect, it } from "vitest";
import { buildCenteredMatrix, selectEligible } from "../src/core/index";
import type { Vote, VoteValue } from "../src/core/index";
import { SEED_CONFIG } from "./fixtures";

const cfg = { ...SEED_CONFIG, min_votes_participant: 2, min_votes_item: 2, min_account_age_days_for_engine: 7 };
const v = (pseudo: string, item: string, value: VoteValue = 1): Vote => ({ pseudo, item, value });

describe("selectEligible (filtro partecipanti ↔ item iterato)", () => {
  it("tiene solo account abbastanza vecchi e con abbastanza voti", () => {
    const votes = [v("old", "i1"), v("old", "i2", -1), v("new", "i1"), v("new", "i2"), v("few", "i1"), v("unknown", "i1"), v("unknown", "i2")];
    const ages = { old: 30, new: 3, few: 30 };
    expect(selectEligible(votes, ages, { ...cfg, min_votes_item: 1 })).toEqual({ participants: ["old"], items: ["i1", "i2"] });
  });

  it("l'età uguale alla soglia è ammessa", () => {
    const votes = [v("p", "i1"), v("p", "i2")];
    expect(selectEligible(votes, { p: 7 }, { ...cfg, min_votes_item: 1 }).participants).toEqual(["p"]);
  });

  it("gli item contano solo i voti dei partecipanti idonei", () => {
    const votes = [v("a", "i1"), v("b", "i1"), v("a", "i2"), v("x", "i2")];
    const res = selectEligible(votes, { a: 30, b: 30, x: 1 }, { ...cfg, min_votes_participant: 1 });
    expect(res).toEqual({ participants: ["a", "b"], items: ["i1"] });
  });

  it("i voti del partecipante contano solo sugli item considerati, fino a stabilità (calcolo a mano, 4 giri)", () => {
    // giro 1: e ha 1 voto → fuori; giro 2: i4 resta con 1 voto → fuori, d resta con 1 voto → fuori;
    // giro 3: i3 resta con 1 voto → fuori, c resta con 1 voto → fuori; giro 4: stabile.
    const votes = [
      v("a", "i1"), v("a", "i2"),
      v("b", "i1"), v("b", "i2"),
      v("c", "i1"), v("c", "i3"),
      v("d", "i3"), v("d", "i4"),
      v("e", "i4"),
    ];
    const ages = { a: 30, b: 30, c: 30, d: 30, e: 30 };
    expect(selectEligible(votes, ages, cfg)).toEqual({ participants: ["a", "b"], items: ["i1", "i2"] });
  });

  it("nessun item considerato → nessun partecipante", () => {
    const votes = [v("a", "i1"), v("a", "i2"), v("b", "i3"), v("b", "i4")];
    expect(selectEligible(votes, { a: 30, b: 30 }, cfg)).toEqual({ participants: [], items: [] });
  });
});

describe("buildCenteredMatrix", () => {
  it("centra sulla media osservata e mette 0 nei mancanti", () => {
    // i1: a=+1, b=-1, c=+1 → media 1/3
    // i2: a=0, b mancante, c=+1 → media 1/2
    const votes: Vote[] = [
      { pseudo: "a", item: "i1", value: 1 },
      { pseudo: "b", item: "i1", value: -1 },
      { pseudo: "c", item: "i1", value: 1 },
      { pseudo: "a", item: "i2", value: 0 },
      { pseudo: "c", item: "i2", value: 1 },
    ];
    const m = buildCenteredMatrix(votes, ["a", "b", "c"], ["i1", "i2"]);
    expect(m.raw[1]?.[1]).toBeNaN();
    expect(m.centered[0]?.[0]).toBeCloseTo(2 / 3);
    expect(m.centered[1]?.[0]).toBeCloseTo(-4 / 3);
    expect(m.centered[2]?.[0]).toBeCloseTo(2 / 3);
    expect(m.centered[0]?.[1]).toBeCloseTo(-1 / 2);
    expect(m.centered[1]?.[1]).toBe(0);
    expect(m.centered[2]?.[1]).toBeCloseTo(1 / 2);
  });

  it("dopo il centraggio ogni colonna ha media 0", () => {
    const votes: Vote[] = [
      { pseudo: "a", item: "i1", value: 1 },
      { pseudo: "b", item: "i1", value: 0 },
      { pseudo: "c", item: "i2", value: -1 },
      { pseudo: "a", item: "i2", value: 1 },
    ];
    const m = buildCenteredMatrix(votes, ["a", "b", "c"], ["i1", "i2"]);
    for (let j = 0; j < 2; j++) {
      const sum = m.centered.reduce((s, row) => s + (row[j] ?? 0), 0);
      expect(sum).toBeCloseTo(0);
    }
  });
});
