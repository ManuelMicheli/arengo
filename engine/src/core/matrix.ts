import type { EngineConfig, Vote } from "./types";

const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface Eligible {
  /** Pseudo dei partecipanti al calcolo, in ordine alfabetico. */
  readonly participants: string[];
  /** Item considerati, in ordine alfabetico. */
  readonly items: string[];
}

/**
 * Passo 1. Partecipanti e item considerati, filtrati a vicenda fino a stabilità:
 * - partecipante: account con età ≥ min_account_age_days_for_engine e almeno
 *   min_votes_participant voti sugli item considerati;
 * - item considerato: almeno min_votes_item voti dei partecipanti.
 * Si parte da tutti gli account abbastanza vecchi e da tutti gli item; ogni giro può
 * solo togliere pseudo o item (insiemi decrescenti), quindi la stabilità arriva in al
 * più (#pseudo + #item) giri: è il tetto strutturale del ciclo, non un parametro.
 * Gli esclusi votano comunque: sono solo fuori dal calcolo.
 */
export function selectEligible(
  votes: readonly Vote[],
  accountAgeDays: Readonly<Record<string, number>>,
  config: Pick<EngineConfig, "min_account_age_days_for_engine" | "min_votes_participant" | "min_votes_item">,
): Eligible {
  const oldEnough = (pseudo: string): boolean => {
    const age = Object.hasOwn(accountAgeDays, pseudo) ? accountAgeDays[pseudo] : undefined;
    return age !== undefined && age >= config.min_account_age_days_for_engine;
  };
  let participants = new Set(votes.map((v) => v.pseudo).filter(oldEnough));
  let items = new Set(votes.map((v) => v.item));
  const maxRounds = participants.size + items.size + 1;

  for (let round = 0; round < maxRounds; round++) {
    const itemCounts = new Map<string, number>();
    for (const v of votes) {
      if (participants.has(v.pseudo) && items.has(v.item)) itemCounts.set(v.item, (itemCounts.get(v.item) ?? 0) + 1);
    }
    const nextItems = new Set([...itemCounts].filter(([, n]) => n >= config.min_votes_item).map(([it]) => it));
    const pseudoCounts = new Map<string, number>();
    for (const v of votes) {
      if (participants.has(v.pseudo) && nextItems.has(v.item)) {
        pseudoCounts.set(v.pseudo, (pseudoCounts.get(v.pseudo) ?? 0) + 1);
      }
    }
    const nextParticipants = new Set(
      [...pseudoCounts].filter(([, n]) => n >= config.min_votes_participant).map(([p]) => p),
    );
    const stable = nextItems.size === items.size && nextParticipants.size === participants.size;
    items = nextItems;
    participants = nextParticipants;
    if (stable) break;
  }
  return { participants: [...participants].sort(byString), items: [...items].sort(byString) };
}

export interface VoteMatrix {
  /** Valori grezzi: +1/-1/0, NaN se il partecipante non ha votato l'item. */
  readonly raw: number[][];
  /** Colonne centrate sulla media osservata, mancanti → 0 dopo il centraggio. */
  readonly centered: number[][];
}

/** Passo 2. Matrice partecipanti × item, nell'ordine degli array ricevuti. */
export function buildCenteredMatrix(
  votes: readonly Vote[],
  participants: readonly string[],
  items: readonly string[],
): VoteMatrix {
  const row = new Map(participants.map((p, i) => [p, i]));
  const col = new Map(items.map((it, j) => [it, j]));
  const raw = participants.map(() => items.map(() => Number.NaN));
  for (const v of votes) {
    const i = row.get(v.pseudo);
    const j = col.get(v.item);
    if (i === undefined || j === undefined) continue;
    (raw[i] as number[])[j] = v.value;
  }
  const means = items.map((_, j) => {
    let sum = 0;
    let n = 0;
    for (const r of raw) {
      const x = r[j] as number;
      if (!Number.isNaN(x)) {
        sum += x;
        n++;
      }
    }
    return n === 0 ? 0 : sum / n;
  });
  const centered = raw.map((r) =>
    r.map((x, j) => (Number.isNaN(x) ? 0 : x - (means[j] as number))),
  );
  return { raw, centered };
}
