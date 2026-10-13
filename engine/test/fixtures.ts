import type { EngineConfig } from "../src/core/index";

// Copia dei valori del seed `platform_config` (migrazione di seed M1) per i test.
// In produzione la config arriva dal DB: il core non ha valori di default.
export const SEED_CONFIG: EngineConfig = {
  min_account_age_days_for_engine: 7,
  min_votes_participant: 7,
  min_votes_item: 5,
  min_votes_per_cluster: 3,
  min_participants_for_clustering: 50,
  k_min: 2,
  k_max: 5,
  bridging_threshold: 0.6,
  bridging_stable_runs: 2,
  divisive_gap: 0.4,
  majority_threshold: 0.6,
  jury_size: 5,
  jury_min_buckets: 3,
  reputation_half_life_days: 90,
  // Non ancora nel seed: da aggiungere al seed in M6 (task 6.1).
  reputation_cross_credit: 1,
  reputation_same_credit: 0.25,
};
