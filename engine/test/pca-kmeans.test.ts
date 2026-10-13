import { describe, expect, it } from "vitest";
import { chooseK, kmeans, mulberry32, project2D, silhouette } from "../src/core/index";

describe("project2D (PCA con ml-pca)", () => {
  it("restituisce 2 coordinate per riga e separa due blocchi opposti", () => {
    const data = [
      [1, 1, -1, -1],
      [1, 1, -1, -1],
      [1, 0.5, -1, -1],
      [-1, -1, 1, 1],
      [-1, -1, 1, 0.5],
      [-1, -1, 1, 1],
    ];
    const p = project2D(data);
    expect(p).toHaveLength(6);
    for (const row of p) expect(row).toHaveLength(2);
    const sign = (x: number) => Math.sign(x);
    const first = p.map((r) => sign(r[0] ?? 0));
    expect(first[0]).toBe(first[1]);
    expect(first[0]).toBe(first[2]);
    expect(first[3]).toBe(first[4]);
    expect(first[0]).not.toBe(first[3]);
  });

  it("colonne a varianza zero non producono NaN", () => {
    const data = [
      [0, 1],
      [0, -1],
      [0, 1],
    ];
    const p = project2D(data);
    for (const row of p) for (const v of row) expect(Number.isFinite(v)).toBe(true);
  });

  it("con un solo item restituisce comunque 2 coordinate (la seconda 0)", () => {
    const p = project2D([[1], [-1], [0.5]]);
    expect(p).toHaveLength(3);
    for (const row of p) {
      expect(row).toHaveLength(2);
      expect(row[1]).toBe(0);
    }
  });

  it("matrice tutta zero → tutti i punti nell'origine", () => {
    const p = project2D([
      [0, 0],
      [0, 0],
    ]);
    for (const row of p) for (const v of row) expect(v).toBe(0);
  });
});

const blobs = (centers: [number, number][], perBlob: number): number[][] => {
  const rng = mulberry32(99);
  const pts: number[][] = [];
  for (const [cx, cy] of centers) {
    for (let i = 0; i < perBlob; i++) pts.push([cx + (rng() - 0.5) * 0.5, cy + (rng() - 0.5) * 0.5]);
  }
  return pts;
};

describe("kmeans", () => {
  it("separa due blocchi lontani", () => {
    const pts = blobs(
      [
        [0, 0],
        [10, 10],
      ],
      20,
    );
    const res = kmeans(pts, 2, mulberry32(1));
    expect(res).not.toBeNull();
    const a = res!.assignments;
    for (let i = 1; i < 20; i++) expect(a[i]).toBe(a[0]);
    for (let i = 21; i < 40; i++) expect(a[i]).toBe(a[20]);
    expect(a[0]).not.toBe(a[20]);
  });

  it("stesso seed → stesso risultato", () => {
    const pts = blobs(
      [
        [0, 0],
        [3, 0],
        [0, 3],
      ],
      15,
    );
    expect(kmeans(pts, 3, mulberry32(5))).toEqual(kmeans(pts, 3, mulberry32(5)));
  });

  it("restituisce null se i punti distinti sono meno di k", () => {
    const pts = [
      [1, 1],
      [1, 1],
      [2, 2],
    ];
    expect(kmeans(pts, 3, mulberry32(1))).toBeNull();
  });

  it("nessun cluster vuoto", () => {
    const pts = blobs(
      [
        [0, 0],
        [5, 5],
      ],
      10,
    );
    const res = kmeans(pts, 4, mulberry32(3))!;
    const sizes = [0, 0, 0, 0];
    for (const c of res.assignments) sizes[c] = (sizes[c] ?? 0) + 1;
    for (const s of sizes) expect(s).toBeGreaterThan(0);
  });
});

describe("silhouette", () => {
  it("caso calcolato a mano: {0,1} e {10,11} sulla retta", () => {
    const pts = [
      [0, 0],
      [1, 0],
      [10, 0],
      [11, 0],
    ];
    const s0 = 1 - 1 / 10.5;
    const s1 = 1 - 1 / 9.5;
    const expected = (s0 + s1 + s1 + s0) / 4;
    expect(silhouette(pts, [0, 0, 1, 1], 2)).toBeCloseTo(expected, 10);
  });

  it("un punto da solo nel suo cluster vale 0", () => {
    const pts = [
      [0, 0],
      [1, 0],
      [10, 0],
    ];
    // s(0) = 1 - 1/10, s(1) = 1 - 1/9, s(2) = 0
    const expected = (1 - 1 / 10 + (1 - 1 / 9) + 0) / 3;
    expect(silhouette(pts, [0, 0, 1], 2)).toBeCloseTo(expected, 10);
  });
});

describe("chooseK", () => {
  it("trova k=3 su tre blocchi, entro [k_min, k_max]", () => {
    const pts = blobs(
      [
        [0, 0],
        [10, 0],
        [5, 9],
      ],
      20,
    );
    const res = chooseK(pts, 2, 5, mulberry32(11));
    expect(res).not.toBeNull();
    expect(res!.k).toBe(3);
    expect(res!.silhouette).toBeGreaterThan(0.8);
  });

  it("trova k=2 su due blocchi", () => {
    const pts = blobs(
      [
        [0, 0],
        [10, 0],
      ],
      25,
    );
    expect(chooseK(pts, 2, 5, mulberry32(11))!.k).toBe(2);
  });

  it("null se non ci sono abbastanza punti distinti per k_min", () => {
    const pts = [
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    expect(chooseK(pts, 2, 5, mulberry32(1))).toBeNull();
  });
});
