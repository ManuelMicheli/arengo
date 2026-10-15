import { describe, expect, it } from "vitest";
import { seededOrder } from "./seed-order";

const items = Array.from({ length: 20 }, (_, i) => ({ id: `id-${i}` }));

describe("seededOrder", () => {
  it("stesso seed, stesso ordine", () => {
    expect(seededOrder(items, "a")).toEqual(seededOrder(items, "a"));
  });

  it("seed diversi, ordini diversi", () => {
    expect(seededOrder(items, "a")).not.toEqual(seededOrder(items, "b"));
  });

  it("non perde né duplica elementi e non modifica l'input", () => {
    const copy = [...items];
    const out = seededOrder(items, "c");
    expect(out).toHaveLength(items.length);
    expect(new Set(out.map((i) => i.id)).size).toBe(items.length);
    expect(items).toEqual(copy);
  });
});
