import { describe, expect, it } from "vitest";
import { orderArguments, type Argument } from "./results";

const arg = (id: string, cross_utility: number | null, side: "pro" | "contro" = "pro"): Argument => ({ id, side, body: id, cross_utility });

describe("orderArguments", () => {
  it("dopo la run: prima per utilità trasversale decrescente", () => {
    const out = orderArguments([arg("a", 0.2), arg("b", 0.9), arg("c", 0.5)], "s");
    expect(out.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });

  it("prima della run: ordine casuale stabile per seed", () => {
    const args = Array.from({ length: 10 }, (_, i) => arg(`x${i}`, null));
    expect(orderArguments(args, "s1")).toEqual(orderArguments(args, "s1"));
    expect(orderArguments(args, "s1")).not.toEqual(orderArguments(args, "s2"));
  });

  it("i valutati vengono prima dei non valutati", () => {
    const out = orderArguments([arg("n", null), arg("v", 0.1)], "s");
    expect(out[0]!.id).toBe("v");
  });
});
