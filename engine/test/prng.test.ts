import { describe, expect, it } from "vitest";
import { hashString, mulberry32, rngFromSeed, shuffle } from "../src/core/index";

describe("hashString (FNV-1a 32 bit)", () => {
  it("riproduce i vettori di test noti", () => {
    expect(hashString("")).toBe(0x811c9dc5);
    expect(hashString("a")).toBe(0xe40c292c);
    expect(hashString("foobar")).toBe(0xbf9cf968);
  });
});

describe("mulberry32", () => {
  it("stesso seed → stessa sequenza", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("seed diversi → sequenze diverse", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it("valori in [0, 1) e media vicina a 0,5", () => {
    const rng = mulberry32(7);
    let sum = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.02);
  });

  it("rngFromSeed usa l'hash della stringa", () => {
    const a = rngFromSeed("run-2026-10-13");
    const b = mulberry32(hashString("run-2026-10-13"));
    expect(a()).toBe(b());
  });
});

describe("shuffle", () => {
  it("è una permutazione deterministica e non modifica l'input", () => {
    const input = ["a", "b", "c", "d", "e", "f"];
    const copy = [...input];
    const s1 = shuffle(input, rngFromSeed("x"));
    const s2 = shuffle(input, rngFromSeed("x"));
    expect(input).toEqual(copy);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(copy);
  });
});
