import { PCA } from "ml-pca";

const DIMENSIONS = 2;

/**
 * Passo 3. Proiezione PCA a 2 componenti (ml-pca, SVD) della matrice già centrata.
 * Se le componenti disponibili sono meno di 2 (un solo item, una sola riga, matrice
 * tutta zero) le coordinate mancanti valgono 0.
 */
export function project2D(centered: readonly (readonly number[])[]): number[][] {
  const rows = centered.length;
  const cols = centered[0]?.length ?? 0;
  if (rows === 0) return [];
  const zero = (): number[] => Array.from({ length: DIMENSIONS }, () => 0);
  const allZero = centered.every((r) => r.every((x) => x === 0));
  if (cols === 0 || allZero) return centered.map(zero);

  // La matrice è già centrata (passo 2): nessun ulteriore centraggio né scalatura,
  // così le colonne a varianza zero restano colonne di zeri invece di dare NaN.
  const pca = new PCA(centered.map((r) => [...r]), { center: false, scale: false });
  const nComponents = Math.min(DIMENSIONS, cols, rows);
  const projected = pca.predict(centered.map((r) => [...r]), { nComponents }).to2DArray();
  return projected.map((r) => {
    const out = zero();
    for (let d = 0; d < nComponents; d++) {
      const v = r[d] ?? 0;
      out[d] = Number.isFinite(v) ? v : 0;
    }
    return out;
  });
}
