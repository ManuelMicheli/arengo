import { describe, expect, it } from "vitest";
import { loadLegal, parseLegal } from "./legal";

describe("parseLegal", () => {
  it("riconosce titoli, elenchi e paragrafi", () => {
    expect(parseLegal("# T\n\n## S\n\n- a\n- b\n\nTesto\nsu due righe")).toEqual([
      { kind: "h1", text: "T" },
      { kind: "h2", text: "S" },
      { kind: "ul", items: ["a", "b"] },
      { kind: "p", text: "Testo su due righe" },
    ]);
  });

  it("i testi legali restano marcati da verificare", async () => {
    for (const doc of ["regole", "consenso-art9", "privacy"] as const) {
      const blocks = await loadLegal(doc);
      expect(JSON.stringify(blocks)).toContain("[DA VERIFICARE CON LEGALE]");
    }
  });
});
