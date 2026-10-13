import type { EngineConfig, ReputationEvent, Vote } from "./types";

// Validazione dell'input. I messaggi d'errore citano chiavi di config, mai pseudo:
// un errore può finire in un log.

const INTEGER_KEYS = [
  "min_account_age_days_for_engine",
  "min_votes_participant",
  "min_votes_item",
  "min_votes_per_cluster",
  "min_participants_for_clustering",
  "k_min",
  "k_max",
  "bridging_stable_runs",
  "jury_size",
  "jury_min_buckets",
] as const satisfies readonly (keyof EngineConfig)[];

const PROBABILITY_KEYS = [
  "bridging_threshold",
  "divisive_gap",
  "majority_threshold",
] as const satisfies readonly (keyof EngineConfig)[];

/** La silhouette richiede almeno 2 cluster. */
const MIN_CLUSTERS = 2;

export function assertValidConfig(config: EngineConfig): void {
  for (const key of INTEGER_KEYS) {
    const v = config[key];
    if (!Number.isInteger(v) || v < 0) throw new Error(`platform_config: ${key} deve essere un intero ≥ 0`);
  }
  for (const key of PROBABILITY_KEYS) {
    const v = config[key];
    if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error(`platform_config: ${key} deve essere tra 0 e 1`);
  }
  for (const key of ["reputation_cross_credit", "reputation_same_credit"] as const) {
    const v = config[key];
    if (!Number.isFinite(v) || v < 0) throw new Error(`platform_config: ${key} deve essere un numero ≥ 0`);
  }
  const share = config.min_cluster_share;
  if (!Number.isFinite(share) || share < 0 || share >= 0.5) {
    throw new Error("platform_config: min_cluster_share deve essere in [0, 0.5)");
  }
  if (!(config.reputation_half_life_days > 0)) {
    throw new Error("platform_config: reputation_half_life_days deve essere > 0");
  }
  if (config.k_min < MIN_CLUSTERS) throw new Error(`platform_config: k_min deve essere ≥ ${MIN_CLUSTERS}`);
  if (config.k_min > config.k_max) throw new Error("platform_config: k_min deve essere ≤ k_max");
  if (config.jury_min_buckets > config.jury_size) {
    throw new Error("platform_config: jury_min_buckets deve essere ≤ jury_size");
  }
}

const isNonEmptyString = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const isValidAge = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;

export function assertValidAccountAges(ages: Readonly<Record<string, number>>): void {
  for (const age of Object.values(ages)) {
    if (!isValidAge(age)) throw new Error("account_age_days: età non valida (NaN, infinita o negativa) nell'input");
  }
}

export function assertValidReputationEvents(events: readonly ReputationEvent[]): void {
  for (const e of events) {
    if (!isNonEmptyString(e.author) || !isNonEmptyString(e.rater) || !isValidAge(e.age_days)) {
      throw new Error("reputation_events: evento non valido (author/rater vuoti o age_days NaN, infinito o negativo)");
    }
  }
}

export function assertValidVotes(votes: readonly Vote[]): void {
  const seen = new Set<string>();
  for (const v of votes) {
    if (!isNonEmptyString(v.pseudo) || !isNonEmptyString(v.item)) throw new Error("voto con pseudo o item vuoto nell'input");
    if (v.value !== -1 && v.value !== 0 && v.value !== 1) throw new Error("voto con valore non valido nell'input");
    const key = JSON.stringify([v.pseudo, v.item]);
    if (seen.has(key)) throw new Error("voto duplicato (stesso pseudo e item) nell'input");
    seen.add(key);
  }
}
