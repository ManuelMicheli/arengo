// Tipi del core del motore di consenso. Nessun I/O: tutto arriva in input.

/** Valore di un voto: +1 d'accordo, -1 contrario, 0 passo. */
export type VoteValue = -1 | 0 | 1;

/** Un voto pseudonimo su un item (proposta, messaggio Piazza, ...). */
export interface Vote {
  readonly pseudo: string;
  readonly item: string;
  readonly value: VoteValue;
}

/**
 * Parametri del motore. Le chiavi sono identiche a quelle di `platform_config`:
 * il chiamante (run.ts, M6) le legge dal DB e le passa così come sono.
 */
export interface EngineConfig {
  readonly min_account_age_days_for_engine: number;
  readonly min_votes_participant: number;
  readonly min_votes_item: number;
  readonly min_votes_per_cluster: number;
  readonly min_participants_for_clustering: number;
  readonly k_min: number;
  readonly k_max: number;
  readonly bridging_threshold: number;
  readonly bridging_stable_runs: number;
  readonly divisive_gap: number;
  readonly majority_threshold: number;
  readonly jury_size: number;
  readonly jury_min_buckets: number;
  readonly reputation_half_life_days: number;
}

export type Classification = "ponte" | "divisivo" | "maggioritario" | "nessun_consenso" | "insufficiente";

/**
 * Evento che genera reputazione: un "utile" a un argomento o un "d'accordo" a un
 * messaggio Piazza. `author` è lo pseudo dell'autore (calcolato fuori dal core),
 * `rater` lo pseudo di chi ha votato, `age_days` l'età del voto in giorni.
 */
export interface ReputationEvent {
  readonly author: string;
  readonly rater: string;
  readonly age_days: number;
}

export interface EngineInput {
  readonly votes: readonly Vote[];
  /** pseudo → età dell'account in giorni. Pseudo assenti = non idonei al calcolo. */
  readonly account_age_days: Readonly<Record<string, number>>;
  /** item → classificazioni delle run precedenti, dalla più vecchia alla più recente. */
  readonly history: Readonly<Record<string, readonly Classification[]>>;
  /** pseudo idonei a fare i giurati (filtro di idoneità applicato fuori dal core). */
  readonly jury_eligible: readonly string[];
  readonly reputation_events: readonly ReputationEvent[];
  /** Seed della run: stesso input + stesso seed → stesso output. */
  readonly seed: string;
  readonly config: EngineConfig;
}

export interface GroupAgreement {
  readonly group: string;
  /** (agree+1)/(agree+disagree+pass+2), null se il gruppo ha meno di min_votes_per_cluster voti sull'item. */
  readonly p_agree: number | null;
}

export interface ItemResult {
  readonly item: string;
  readonly votes: number;
  readonly agree: number;
  readonly disagree: number;
  readonly pass: number;
  /** agree / votes, sui soli partecipanti idonei. */
  readonly total_approval: number;
  /** Vuoto se l'esito è `insufficient`. */
  readonly groups: readonly GroupAgreement[];
  readonly bridging_score: number | null;
  /** null se l'esito è `insufficient` (niente gruppi). */
  readonly classification: Classification | null;
  readonly stable_ponte: boolean;
}

export interface ClusterStat {
  /** "Gruppo 1" ... "Gruppo k": etichetta anonima, ricalcolata a ogni run. */
  readonly label: string;
  readonly size: number;
}

export interface JuryPanel {
  readonly panel_id: number;
  /** Pseudo dei membri in ordine alfabetico: l'ordine non rivela il gruppo. */
  readonly members: readonly string[];
}

export interface ReputationScore {
  readonly pseudo: string;
  readonly score: number;
}

export type InsufficientReason = "too_few_participants" | "no_items" | "no_structure";

/** Output aggregato della run: è l'unica cosa che può essere salvata o pubblicata. */
export interface EngineOutput {
  readonly outcome: "clustered" | "insufficient";
  readonly insufficient_reason: InsufficientReason | null;
  readonly participants: number;
  readonly items_considered: number;
  readonly k: number | null;
  readonly silhouette: number | null;
  readonly clusters: readonly ClusterStat[];
  readonly items: readonly ItemResult[];
  readonly jury_panels: readonly JuryPanel[];
  readonly reputation: readonly ReputationScore[];
}
