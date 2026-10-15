import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accetta percorsi dello stesso sito", () => {
    expect(safeNext("/proposte/abc")).toBe("/proposte/abc");
    expect(safeNext("/cerca?q=casa#r")).toBe("/cerca?q=casa#r");
  });

  it("rifiuta tutto ciò che può portare fuori", () => {
    for (const bad of ["//evil.com", String.raw`/\evil.com`,"https://evil.com", "evil.com", "/\t/evil.com", "/\n/evil.com", "", null, 42]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  it("usa il fallback indicato", () => {
    expect(safeNext("//x", "/temi")).toBe("/temi");
  });
});
