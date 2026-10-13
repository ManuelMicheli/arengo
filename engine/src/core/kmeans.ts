import type { Rng } from "./prng";

type Point = readonly number[];

function sqDist(a: Point, b: Point): number {
  let s = 0;
  for (let d = 0; d < a.length; d++) {
    const diff = (a[d] as number) - (b[d] as number);
    s += diff * diff;
  }
  return s;
}

function countDistinct(points: readonly Point[]): number {
  return new Set(points.map((p) => p.join(","))).size;
}

export interface KMeansResult {
  /** Indice del cluster (0..k-1) per ogni punto, nell'ordine dei punti. */
  readonly assignments: number[];
  readonly centroids: number[][];
}

/** k-means++: primo centro uniforme, i successivi con probabilità ∝ distanza². */
function initCentroids(points: readonly Point[], k: number, rng: Rng): number[][] | null {
  const first = points[Math.floor(rng() * points.length)] as Point;
  const centroids: number[][] = [[...first]];
  const d2 = points.map((p) => sqDist(p, first));
  while (centroids.length < k) {
    const total = d2.reduce((s, x) => s + x, 0);
    if (total === 0) return null;
    let r = rng() * total;
    let chosen = -1;
    for (let i = 0; i < points.length; i++) {
      const w = d2[i] as number;
      if (w === 0) continue;
      chosen = i;
      r -= w;
      if (r < 0) break;
    }
    const c = points[chosen] as Point;
    centroids.push([...c]);
    for (let i = 0; i < points.length; i++) {
      d2[i] = Math.min(d2[i] as number, sqDist(points[i] as Point, c));
    }
  }
  return centroids;
}

function computeCentroids(points: readonly Point[], assignments: readonly number[], k: number, dim: number): (number[] | null)[] {
  const sums = Array.from({ length: k }, () => Array.from({ length: dim }, () => 0));
  const counts = Array.from({ length: k }, () => 0);
  for (let i = 0; i < points.length; i++) {
    const c = assignments[i] as number;
    counts[c] = (counts[c] as number) + 1;
    const p = points[i] as Point;
    const s = sums[c] as number[];
    for (let d = 0; d < dim; d++) s[d] = (s[d] as number) + (p[d] as number);
  }
  return sums.map((s, c) => {
    const n = counts[c] as number;
    return n === 0 ? null : s.map((x) => x / n);
  });
}

function inertia(points: readonly Point[], assignments: readonly number[], centroids: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) s += sqDist(points[i] as Point, centroids[assignments[i] as number] as Point);
  return s;
}

/**
 * Riempie i cluster vuoti spostandoci il punto più lontano dal proprio centro
 * (tra quelli in cluster con più di un punto). Deterministico: a parità, indice minore.
 */
function fillEmpty(points: readonly Point[], assignments: number[], centroids: (number[] | null)[]): number[][] {
  for (let c = 0; c < centroids.length; c++) {
    if (centroids[c] !== null) continue;
    const sizes = new Map<number, number>();
    for (const a of assignments) sizes.set(a, (sizes.get(a) ?? 0) + 1);
    let best = -1;
    let bestD = -1;
    for (let i = 0; i < points.length; i++) {
      const a = assignments[i] as number;
      const own = centroids[a];
      if (!own || (sizes.get(a) ?? 0) < 2) continue;
      const d = sqDist(points[i] as Point, own);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    const p = points[best] as Point;
    assignments[best] = c;
    centroids[c] = [...p];
  }
  return centroids as number[][];
}

/**
 * k-means (Lloyd) con inizializzazione k-means++ e PRNG in input.
 * Un punto cambia cluster solo se un altro centro è strettamente più vicino; ci si
 * ferma quando le assegnazioni non cambiano o l'inerzia smette di scendere.
 * Restituisce null se i punti distinti sono meno di k.
 */
export function kmeans(points: readonly Point[], k: number, rng: Rng): KMeansResult | null {
  if (k < 1 || countDistinct(points) < k) return null;
  const dim = points[0]?.length ?? 0;
  const init = initCentroids(points, k, rng);
  if (!init) return null;
  let centroids = init;
  let assignments = points.map(() => -1);
  let prevInertia = Number.POSITIVE_INFINITY;

  for (;;) {
    let changed = false;
    const next = assignments.map((current, i) => {
      const p = points[i] as Point;
      let best = current;
      let bestD = current >= 0 ? sqDist(p, centroids[current] as Point) : Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c++) {
        const d = sqDist(p, centroids[c] as Point);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best !== current) changed = true;
      return best;
    });
    if (!changed) break;
    const nextCentroids = fillEmpty(points, next, computeCentroids(points, next, k, dim));
    const nextInertia = inertia(points, next, nextCentroids);
    if (!(nextInertia < prevInertia)) break;
    assignments = next;
    centroids = nextCentroids;
    prevInertia = nextInertia;
  }
  return { assignments, centroids };
}

/**
 * Silhouette media (implementazione diretta, O(n²)). Per ogni punto:
 * s = (b - a) / max(a, b), con a = distanza media dal proprio cluster e
 * b = minima distanza media da un altro cluster; un punto solo nel suo cluster vale 0.
 */
export function silhouette(points: readonly Point[], assignments: readonly number[], k: number): number {
  const n = points.length;
  if (n === 0) return 0;
  const sizes = Array.from({ length: k }, () => 0);
  for (const a of assignments) sizes[a] = (sizes[a] as number) + 1;
  let total = 0;
  const sums = Array.from({ length: k }, () => 0);
  for (let i = 0; i < n; i++) {
    sums.fill(0);
    const p = points[i] as Point;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const c = assignments[j] as number;
      sums[c] = (sums[c] as number) + Math.sqrt(sqDist(p, points[j] as Point));
    }
    const own = assignments[i] as number;
    const ownSize = sizes[own] as number;
    if (ownSize <= 1) continue;
    const a = (sums[own] as number) / (ownSize - 1);
    let b = Number.POSITIVE_INFINITY;
    for (let c = 0; c < k; c++) {
      if (c === own || (sizes[c] as number) === 0) continue;
      b = Math.min(b, (sums[c] as number) / (sizes[c] as number));
    }
    const m = Math.max(a, b);
    if (Number.isFinite(b) && m > 0) total += (b - a) / m;
  }
  return total / n;
}

export interface ChooseKResult extends KMeansResult {
  readonly k: number;
  readonly silhouette: number;
}

/**
 * Passo 4. Prova k in [kMin, kMax] e tiene la silhouette massima; a parità vince il k
 * più piccolo. k oltre (punti distinti) o oltre (n - 1) viene saltato.
 * Null se nessun k è applicabile (struttura assente).
 */
export function chooseK(points: readonly Point[], kMin: number, kMax: number, rng: Rng): ChooseKResult | null {
  const upper = Math.min(kMax, points.length - 1, countDistinct(points));
  let best: ChooseKResult | null = null;
  for (let k = kMin; k <= upper; k++) {
    const res = kmeans(points, k, rng);
    if (!res) continue;
    const s = silhouette(points, res.assignments, k);
    if (best === null || s > best.silhouette) best = { ...res, k, silhouette: s };
  }
  return best;
}
