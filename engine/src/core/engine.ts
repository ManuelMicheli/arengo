import { computeItemResults, groupLabel } from "./consensus";
import { OpinionGroups, formJuryPanels } from "./groups";
import { chooseK, type ChooseKResult } from "./kmeans";
import { buildCenteredMatrix, selectItems, selectParticipants } from "./matrix";
import { project2D } from "./pca";
import { rngFromSeed } from "./prng";
import { computeReputation } from "./reputation";
import type { EngineInput, EngineOutput, InsufficientReason } from "./types";
import { assertValidConfig, assertValidVotes } from "./validate";

export interface EngineResult {
  /** Solo aggregati: è l'unica parte da salvare/pubblicare. */
  readonly output: EngineOutput;
  /** Gruppi della run, solo in memoria (per il sorteggio curatori). Mai da salvare. */
  readonly groups: OpinionGroups;
}

/**
 * Rinumera i cluster per dimensione decrescente (a parità: centroide con x, poi y,
 * minore; poi indice originale) così le etichette "Gruppo 1..k" non dipendono
 * dall'ordine interno del k-means.
 */
function relabel(res: ChooseKResult): number[] {
  const sizes = Array.from({ length: res.k }, () => 0);
  for (const a of res.assignments) sizes[a] = (sizes[a] as number) + 1;
  const order = sizes
    .map((size, c) => ({ c, size, x: res.centroids[c]?.[0] ?? 0, y: res.centroids[c]?.[1] ?? 0 }))
    .sort((a, b) => b.size - a.size || a.x - b.x || a.y - b.y || a.c - b.c)
    .map((o) => o.c);
  const newIndex = Array.from({ length: res.k }, () => 0);
  order.forEach((oldC, i) => (newIndex[oldC] = i));
  return newIndex;
}

/** Esegue i passi 1-10 dell'algoritmo (docs/ALGORITMO.md). Funzione pura. */
export function runEngine(input: EngineInput): EngineResult {
  const { config } = input;
  assertValidConfig(config);
  assertValidVotes(input.votes);

  const participants = selectParticipants(input.votes, input.account_age_days, config);
  const participantSet = new Set(participants);
  const items = selectItems(input.votes, participantSet, config);

  const insufficient = (reason: InsufficientReason): EngineResult => {
    const none = new Map<string, number>();
    return {
      output: {
        outcome: "insufficient",
        insufficient_reason: reason,
        participants: participants.length,
        items_considered: items.length,
        k: null,
        silhouette: null,
        clusters: [],
        items: computeItemResults(input.votes, participantSet, items, none, 0, input.history, config),
        jury_panels: formJuryPanels(none, 0, input.jury_eligible, config, rngFromSeed(`${input.seed}:jury`)),
        reputation: computeReputation(input.reputation_events, none, participantSet, config),
      },
      groups: new OpinionGroups(none, 0),
    };
  };

  if (participants.length < config.min_participants_for_clustering) return insufficient("too_few_participants");
  if (items.length === 0) return insufficient("no_items");

  const { centered } = buildCenteredMatrix(input.votes, participants, items);
  const points = project2D(centered);
  const best = chooseK(points, config.k_min, config.k_max, rngFromSeed(`${input.seed}:kmeans`));
  if (!best) return insufficient("no_structure");

  const newIndex = relabel(best);
  // Assegnazione pseudo → gruppo: vive solo qui e dentro OpinionGroups.
  const groupOf = new Map<string, number>();
  participants.forEach((p, i) => groupOf.set(p, newIndex[best.assignments[i] as number] as number));
  const sizes = Array.from({ length: best.k }, () => 0);
  for (const g of groupOf.values()) sizes[g] = (sizes[g] as number) + 1;

  return {
    output: {
      outcome: "clustered",
      insufficient_reason: null,
      participants: participants.length,
      items_considered: items.length,
      k: best.k,
      silhouette: best.silhouette,
      clusters: sizes.map((size, g) => ({ label: groupLabel(g), size })),
      items: computeItemResults(input.votes, participantSet, items, groupOf, best.k, input.history, config),
      jury_panels: formJuryPanels(groupOf, best.k, input.jury_eligible, config, rngFromSeed(`${input.seed}:jury`)),
      reputation: computeReputation(input.reputation_events, groupOf, participantSet, config),
    },
    groups: new OpinionGroups(groupOf, best.k),
  };
}
