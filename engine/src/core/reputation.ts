import type { EngineConfig, ReputationEvent, ReputationScore } from "./types";

const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Passo 9. Reputazione per pseudo autore. Ogni "utile"/"d'accordo" vale:
 * - 0 se chi vota non è un partecipante idoneo al calcolo (account più giovane di
 *   min_account_age_days_for_engine o con meno di min_votes_participant voti) o è l'autore;
 * - reputation_cross_credit se autore e votante hanno entrambi un gruppo e sono in gruppi diversi;
 * - reputation_same_credit altrimenti (stesso gruppo, o autore/run senza gruppo).
 * Decadimento: 0,5^(età / reputation_half_life_days). Gli eventi a credito 0 non
 * contano: un autore che riceve solo quelli non compare. Output in ordine alfabetico.
 */
export function computeReputation(
  events: readonly ReputationEvent[],
  groupOf: ReadonlyMap<string, number>,
  participants: ReadonlySet<string>,
  config: Pick<EngineConfig, "reputation_half_life_days" | "reputation_cross_credit" | "reputation_same_credit">,
): ReputationScore[] {
  const scores = new Map<string, number>();
  for (const e of events) {
    if (e.author === e.rater || !participants.has(e.rater)) continue;
    const ga = groupOf.get(e.author);
    const gr = groupOf.get(e.rater);
    const credit =
      ga !== undefined && gr !== undefined && ga !== gr ? config.reputation_cross_credit : config.reputation_same_credit;
    if (credit === 0) continue;
    const decay = Math.pow(0.5, Math.max(0, e.age_days) / config.reputation_half_life_days);
    scores.set(e.author, (scores.get(e.author) ?? 0) + credit * decay);
  }
  return [...scores.keys()].sort(byString).map((pseudo) => ({ pseudo, score: scores.get(pseudo) as number }));
}
