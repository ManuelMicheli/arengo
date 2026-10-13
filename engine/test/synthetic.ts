import { hashString, rngFromSeed, shuffle } from "../src/core/index";
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

/** Item con conteggi esatti per gruppo vero: [d'accordo, contrari, passo]. */
export interface ExactItem {
  readonly id: string;
  readonly perGroup: readonly (readonly [number, number, number])[];
}

/**
 * Generatore a conteggi esatti: per ogni item e gruppo, i primi `agree` membri (in un
 * ordine mescolato dal seed, diverso per ogni item) votano +1, i successivi -1, poi 0;
 * gli altri non votano. Permette di calcolare a mano p_agree e classificazioni.
 */
export function generateExact(seed: string, groupSizes: readonly number[], items: readonly ExactItem[], ageDays = 30): SyntheticData {
  const rng = rngFromSeed(seed);
  const truth = new Map<string, number>();
  const ages: Record<string, number> = {};
  const members: string[][] = [];
  let n = 0;
  groupSizes.forEach((size, g) => {
    const list: string[] = [];
    for (let u = 0; u < size; u++) {
      const pseudo = `ex-${hashString(`${seed}:${n++}`).toString(16).padStart(8, "0")}`;
      truth.set(pseudo, g);
      ages[pseudo] = ageDays;
      list.push(pseudo);
    }
    members.push(list);
  });
  const votes: Vote[] = [];
  for (const item of items) {
    item.perGroup.forEach(([agree, disagree, pass], g) => {
      const order = shuffle(members[g] ?? [], rng);
      order.forEach((pseudo, i) => {
        if (i < agree) votes.push({ pseudo, item: item.id, value: 1 });
        else if (i < agree + disagree) votes.push({ pseudo, item: item.id, value: -1 });
        else if (i < agree + disagree + pass) votes.push({ pseudo, item: item.id, value: 0 });
      });
    });
  }
  return { votes, ages, truth, polarized: [], bridges: [] };
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
