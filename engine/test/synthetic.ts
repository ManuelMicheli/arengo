import { hashString, rngFromSeed } from "../src/core/index";
import type { Vote, VoteValue } from "../src/core/index";

// Generatore deterministico di dati sintetici per i test del motore.

export interface SyntheticOptions {
  readonly seed: string;
  /** Numero di utenti per gruppo d'opinione "vero". */
  readonly groupSizes: readonly number[];
  /** Item polarizzati: l'item i è voluto dal gruppo (i mod G) e respinto dagli altri. */
  readonly polarizedItems: number;
  /** Item trasversali: approvati da tutti i gruppi. */
  readonly bridgeItems: number;
  /** Probabilità che un utente voti un item. */
  readonly voteProbability: number;
  /** Probabilità di votare secondo la linea del proprio gruppo sugli item polarizzati. */
  readonly loyalty: number;
  /** Probabilità di approvare un item trasversale. */
  readonly bridgeAgree: number;
  readonly ageDays: number;
}

export interface SyntheticData {
  readonly votes: Vote[];
  readonly ages: Record<string, number>;
  /** Gruppo vero di ogni pseudo: lo conosce solo il test, mai il motore. */
  readonly truth: Map<string, number>;
  readonly polarized: string[];
  readonly bridges: string[];
}

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.floor(r * xs.length)] as T;

export function generatePolarized(o: SyntheticOptions): SyntheticData {
  const rng = rngFromSeed(o.seed);
  const groups = o.groupSizes.length;
  const polarized = Array.from({ length: o.polarizedItems }, (_, i) => `pol-${String(i).padStart(2, "0")}`);
  const bridges = Array.from({ length: o.bridgeItems }, (_, i) => `bridge-${i}`);
  const votes: Vote[] = [];
  const ages: Record<string, number> = {};
  const truth = new Map<string, number>();
  let n = 0;
  o.groupSizes.forEach((size, g) => {
    for (let u = 0; u < size; u++) {
      // pseudo opaco, come un HMAC: non contiene il gruppo
      const pseudo = `ps-${hashString(`${o.seed}:${n++}`).toString(16).padStart(8, "0")}`;
      truth.set(pseudo, g);
      ages[pseudo] = o.ageDays;
      polarized.forEach((item, i) => {
        if (rng() >= o.voteProbability) return;
        const favored = i % groups === g;
        const value: VoteValue = rng() < o.loyalty ? (favored ? 1 : -1) : pick([-1, 0, 1] as const, rng());
        votes.push({ pseudo, item, value });
      });
      for (const item of bridges) {
        if (rng() >= o.voteProbability) continue;
        const value: VoteValue = rng() < o.bridgeAgree ? 1 : pick([-1, 0] as const, rng());
        votes.push({ pseudo, item, value });
      }
    }
  });
  return { votes, ages, truth, polarized, bridges };
}

export const BASE_OPTIONS: SyntheticOptions = {
  seed: "sintetico-1",
  groupSizes: [100, 100],
  polarizedItems: 10,
  bridgeItems: 5,
  voteProbability: 0.8,
  loyalty: 0.85,
  bridgeAgree: 0.8,
  ageDays: 30,
};
