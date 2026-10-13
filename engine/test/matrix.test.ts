import { describe, expect, it } from "vitest";
import { buildCenteredMatrix, selectParticipants, selectItems } from "../src/core/index";
import type { Vote } from "../src/core/index";
import { SEED_CONFIG } from "./fixtures";

const cfg = { ...SEED_CONFIG, min_votes_participant: 2, min_votes_item: 2, min_account_age_days_for_engine: 7 };

describe("selectParticipants", () => {
  it("tiene solo account abbastanza vecchi e con abbastanza voti", () => {
    const votes: Vote[] = [
      { pseudo: "old", item: "i1", value: 1 },
      { pseudo: "old", item: "i2", value: -1 },
      { pseudo: "new", item: "i1", value: 1 },
      { pseudo: "new", item: "i2", value: 1 },
      { pseudo: "few", item: "i1", value: 1 },
      { pseudo: "unknown", item: "i1", value: 1 },
      { pseudo: "unknown", item: "i2", value: 1 },
    ];
    const ages = { old: 30, new: 3, few: 30 };
    expect(selectParticipants(votes, ages, cfg)).toEqual(["old"]);
  });

  it("l'età uguale alla soglia è ammessa", () => {
    const votes: Vote[] = [
      { pseudo: "p", item: "i1", value: 1 },
      { pseudo: "p", item: "i2", value: 1 },
    ];
    expect(selectParticipants(votes, { p: 7 }, cfg)).toEqual(["p"]);
  });
});

describe("selectItems", () => {
  it("conta solo i voti dei partecipanti idonei", () => {
    const votes: Vote[] = [
      { pseudo: "a", item: "i1", value: 1 },
      { pseudo: "b", item: "i1", value: 1 },
      { pseudo: "a", item: "i2", value: 1 },
      { pseudo: "x", item: "i2", value: 1 },
    ];
    expect(selectItems(votes, new Set(["a", "b"]), cfg)).toEqual(["i1"]);
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
