import type { EngineConfig, Vote } from "./types";

const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Passo 1a. Partecipanti al calcolo: account con età ≥ min_account_age_days_for_engine
 * e almeno min_votes_participant voti (su qualunque item). Gli esclusi votano
 * comunque: sono solo fuori dal calcolo. Restituisce gli pseudo in ordine alfabetico.
 */
export function selectParticipants(
  votes: readonly Vote[],
  accountAgeDays: Readonly<Record<string, number>>,
  config: Pick<EngineConfig, "min_account_age_days_for_engine" | "min_votes_participant">,
): string[] {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.pseudo, (counts.get(v.pseudo) ?? 0) + 1);
  const out: string[] = [];
  for (const [pseudo, n] of counts) {
    const age = Object.hasOwn(accountAgeDays, pseudo) ? accountAgeDays[pseudo] : undefined;
    if (age === undefined || !(age >= config.min_account_age_days_for_engine)) continue;
    if (n < config.min_votes_participant) continue;
    out.push(pseudo);
  }
  return out.sort(byString);
}

/**
 * Passo 1b. Item considerati: almeno min_votes_item voti dei soli partecipanti idonei
 * (così account nuovi in blocco non rendono "valido" un item). Ordine alfabetico.
 */
export function selectItems(
  votes: readonly Vote[],
  participants: ReadonlySet<string>,
  config: Pick<EngineConfig, "min_votes_item">,
): string[] {
  const counts = new Map<string, number>();
  for (const v of votes) {
    if (!participants.has(v.pseudo)) continue;
    counts.set(v.item, (counts.get(v.item) ?? 0) + 1);
  }
  const out: string[] = [];
  for (const [item, n] of counts) if (n >= config.min_votes_item) out.push(item);
  return out.sort(byString);
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
