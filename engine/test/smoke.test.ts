import { PCA } from "ml-pca";
import { describe, expect, it } from "vitest";

// Smoke test di M0: verifica che la dipendenza ml-pca sia installata e utilizzabile.
// Lo stream E1 può sostituirlo con i test del core.
describe("engine smoke", () => {
  it("ml-pca proietta su 2 componenti", () => {
    const data = [
      [1, 0, 1],
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ];
    const projected = new PCA(data).predict(data, { nComponents: 2 });
    expect(projected.rows).toBe(4);
    expect(projected.columns).toBe(2);
  });
});
