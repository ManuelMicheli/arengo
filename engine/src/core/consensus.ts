import type { Classification, EngineConfig, GroupAgreement, ItemResult, RunClassification, Vote } from "./types";

/** Etichetta anonima del gruppo d'opinione: "Gruppo 1" ... "Gruppo k". */
export function groupLabel(index: number): string {
  return `Gruppo ${index + 1}`;
}

/** Passo 5. Probabilità di accordo con lisciatura di Laplace. */
export function pAgree(agree: number, disagree: number, pass: number): number {
  return (agree + 1) / (agree + disagree + pass + 2);
}

/**
 * Passo 6. Classificazione da p_agree per gruppo (null = voti insufficienti nel gruppo)
 * e approvazione totale. Ordine: ponte → divisivo → maggioritario → nessun_consenso.
 */
export function classify(
  groupP: readonly (number | null)[],
  totalApproval: number,
  config: Pick<EngineConfig, "bridging_threshold" | "divisive_gap" | "majority_threshold">,
): { bridging_score: number | null; classification: Classification } {
  if (groupP.length === 0 || groupP.some((p) => p === null)) {
    return { bridging_score: null, classification: "insufficiente" };
  }
  const ps = groupP as number[];
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  let classification: Classification;
  if (min >= config.bridging_threshold) classification = "ponte";
  else if (max - min >= config.divisive_gap) classification = "divisivo";
  else if (totalApproval >= config.majority_threshold) classification = "maggioritario";
  else classification = "nessun_consenso";
  return { bridging_score: min, classification };
}

/**
 * Passo 7. Ponte stabile: ponte nella run corrente e nelle (bridging_stable_runs - 1)
 * run immediatamente precedenti. `history` va dalla più vecchia alla più recente, una
 * voce per run: `assente` o `insufficiente` rompono la serie.
 */
export function isStablePonte(
  current: Classification | null,
  history: readonly RunClassification[],
  bridgingStableRuns: number,
): boolean {
  if (current !== "ponte") return false;
  const needed = bridgingStableRuns - 1;
  if (needed <= 0) return true;
  if (history.length < needed) return false;
  return history.slice(history.length - needed).every((c) => c === "ponte");
}

interface Tally {
  agree: number;
  disagree: number;
  pass: number;
}

const emptyTally = (): Tally => ({ agree: 0, disagree: 0, pass: 0 });

function addVote(t: Tally, value: number): void {
  if (value > 0) t.agree++;
  else if (value < 0) t.disagree++;
  else t.pass++;
}

/**
 * Passi 5-7 per ogni item: conteggi dei soli partecipanti, p_agree per gruppo,
 * bridging_score, classificazione, stabilità. Con k = 0 (esito `insufficient`)
 * restituisce solo i conteggi e l'approvazione totale.
 * `groupOf` è in memoria e non finisce nell'output: escono solo aggregati per gruppo.
 */
export function computeItemResults(
  votes: readonly Vote[],
  participants: ReadonlySet<string>,
  items: readonly string[],
  groupOf: ReadonlyMap<string, number>,
  k: number,
  history: Readonly<Record<string, readonly RunClassification[]>>,
  config: Pick<
    EngineConfig,
    "min_votes_per_cluster" | "bridging_threshold" | "divisive_gap" | "majority_threshold" | "bridging_stable_runs"
  >,
): ItemResult[] {
  const index = new Map(items.map((it, i) => [it, i]));
  const totals = items.map(emptyTally);
  const perGroup = items.map(() => Array.from({ length: k }, emptyTally));
  for (const v of votes) {
    if (!participants.has(v.pseudo)) continue;
    const i = index.get(v.item);
    if (i === undefined) continue;
    addVote(totals[i] as Tally, v.value);
    const g = groupOf.get(v.pseudo);
    if (g !== undefined && g < k) addVote((perGroup[i] as Tally[])[g] as Tally, v.value);
  }

  return items.map((item, i) => {
    const t = totals[i] as Tally;
    const n = t.agree + t.disagree + t.pass;
    const totalApproval = n === 0 ? 0 : t.agree / n;
    const base = { item, votes: n, agree: t.agree, disagree: t.disagree, pass: t.pass, total_approval: totalApproval };
    if (k === 0) {
      return { ...base, groups: [], bridging_score: null, classification: null, stable_ponte: false };
    }
    const groupP = (perGroup[i] as Tally[]).map((g) => {
      const gn = g.agree + g.disagree + g.pass;
      return gn >= config.min_votes_per_cluster ? pAgree(g.agree, g.disagree, g.pass) : null;
    });
    const groups: GroupAgreement[] = groupP.map((p, g) => ({ group: groupLabel(g), p_agree: p }));
    const { bridging_score, classification } = classify(groupP, totalApproval, config);
    const past = Object.hasOwn(history, item) ? (history[item] ?? []) : [];
    return {
      ...base,
      groups,
      bridging_score,
      classification,
      stable_ponte: isStablePonte(classification, past, config.bridging_stable_runs),
    };
  });
}
