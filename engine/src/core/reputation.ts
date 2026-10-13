import type { EngineConfig, ReputationEvent, ReputationScore } from "./types";

// Crediti fissati dalla specifica (docs/PLAN.md, E1 punto 9). Non sono in
// `platform_config`: spostarli lì richiede una migrazione (fuori dallo stream E1).
export const CROSS_GROUP_CREDIT = 1;
export const SAME_GROUP_CREDIT = 0.25;

const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Passo 9. Reputazione per pseudo autore: ogni "utile"/"d'accordo" vale
 * CROSS_GROUP_CREDIT se autore e votante hanno entrambi un gruppo e sono in gruppi
 * diversi, SAME_GROUP_CREDIT altrimenti (stesso gruppo o gruppo sconosciuto),
 * 0 se votante = autore. Decadimento: 0,5^(età / reputation_half_life_days).
 * Restituisce solo punteggi per autore, in ordine alfabetico.
 */
export function computeReputation(
  events: readonly ReputationEvent[],
  groupOf: ReadonlyMap<string, number>,
  config: Pick<EngineConfig, "reputation_half_life_days">,
): ReputationScore[] {
  const scores = new Map<string, number>();
  for (const e of events) {
    let credit = 0;
    if (e.author !== e.rater) {
      const ga = groupOf.get(e.author);
      const gr = groupOf.get(e.rater);
      credit = ga !== undefined && gr !== undefined && ga !== gr ? CROSS_GROUP_CREDIT : SAME_GROUP_CREDIT;
    }
    const decay = Math.pow(0.5, Math.max(0, e.age_days) / config.reputation_half_life_days);
    scores.set(e.author, (scores.get(e.author) ?? 0) + credit * decay);
  }
  return [...scores.keys()].sort(byString).map((pseudo) => ({ pseudo, score: scores.get(pseudo) as number }));
}
