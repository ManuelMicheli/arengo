import { rngFromSeed, shuffle, type Rng } from "./prng";
import type { EngineConfig, JuryPanel } from "./types";

const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const uniqueSorted = (xs: readonly string[]): string[] => [...new Set(xs)].sort(byString);

/** Run senza gruppi: panel disgiunti estratti a caso tra gli idonei, diversity false. */
function randomPanels(eligible: readonly string[], size: number, rng: Rng): JuryPanel[] {
  const pool = shuffle(uniqueSorted(eligible), rng);
  const panels: JuryPanel[] = [];
  for (let start = 0; start + size <= pool.length; start += size) {
    panels.push({ panel_id: panels.length + 1, diversity: false, members: pool.slice(start, start + size).sort(byString) });
  }
  return panels;
}

/**
 * Passo 8. Panel giuria disgiunti dagli idonei.
 * - Bucket = gruppi a quota (belowShare[g] === false) con almeno un idoneo.
 * - Con ≥ 2 bucket: ogni panel ha jury_size membri da almeno min(jury_min_buckets,
 *   numero di bucket) bucket diversi (un membro da ciascuno dei bucket più numerosi, poi i
 *   posti restanti dal bucket con più idonei rimasti); gli idonei dei gruppi sotto quota o
 *   senza gruppo completano i panel ma non contano per la diversità. diversity: true.
 * - Con 0 o 1 bucket (o run senza gruppi): panel casuali tra tutti gli idonei, diversity: false.
 * - Mai zero panel se gli idonei sono almeno jury_size.
 * Output: solo panel_id, diversity e membri in ordine alfabetico, nessuna etichetta.
 */
export function formJuryPanels(
  groupOf: ReadonlyMap<string, number>,
  belowShare: readonly boolean[],
  eligible: readonly string[],
  config: Pick<EngineConfig, "jury_size" | "jury_min_buckets">,
  rng: Rng,
): JuryPanel[] {
  const size = config.jury_size;
  if (size < 1) return [];
  const pool = uniqueSorted(eligible);
  if (belowShare.length === 0) return randomPanels(pool, size, rng);

  const byGroup = new Map<number, string[]>();
  const fillerList: string[] = [];
  for (const p of pool) {
    const g = groupOf.get(p);
    if (g === undefined || belowShare[g] !== false) {
      fillerList.push(p);
      continue;
    }
    const list = byGroup.get(g) ?? [];
    list.push(p);
    byGroup.set(g, list);
  }
  const groupIds = [...byGroup.keys()].sort((a, b) => a - b);
  if (groupIds.length <= 1) return randomPanels(pool, size, rng);
  const buckets = groupIds.map((g) => shuffle(byGroup.get(g) as string[], rng));
  const fillers = shuffle(fillerList, rng);
  const minBuckets = Math.min(config.jury_min_buckets, buckets.length);

  const largestFirst = (): number[] =>
    buckets
      .map((b, i) => ({ i, n: b.length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((x) => x.i);

  const panels: JuryPanel[] = [];
  for (;;) {
    const order = largestFirst();
    const remaining = buckets.reduce((s, b) => s + b.length, 0) + fillers.length;
    if (order.length < minBuckets || remaining < size) break;
    const members: string[] = [];
    for (const i of order.slice(0, minBuckets)) members.push((buckets[i] as string[]).pop() as string);
    while (members.length < size) {
      const i = largestFirst()[0];
      members.push((i === undefined ? fillers : (buckets[i] as string[])).pop() as string);
    }
    panels.push({ panel_id: panels.length + 1, diversity: true, members: members.sort(byString) });
  }
  if (panels.length === 0 && pool.length >= size) return randomPanels(pool, size, rng);
  return panels;
}

/**
 * Sorteggio stratificato (curatori, M8): quote proporzionali alla dimensione di ogni
 * strato (gruppi d'opinione + uno strato per chi non ha gruppo), metodo dei resti più
 * grandi (a parità: strato più numeroso, poi ordine dei gruppi). Dentro lo strato
 * sorteggio con il PRNG. Output in ordine alfabetico: non rivela gli strati.
 */
export function stratifiedDraw(
  groupOf: ReadonlyMap<string, number>,
  eligible: readonly string[],
  rng: Rng,
  count: number,
): string[] {
  const all = uniqueSorted(eligible);
  if (count >= all.length) return all;
  if (count <= 0) return [];

  const UNASSIGNED = Number.POSITIVE_INFINITY; // ultimo nell'ordine degli strati
  const strata = new Map<number, string[]>();
  for (const p of all) {
    const key = groupOf.get(p) ?? UNASSIGNED;
    const list = strata.get(key) ?? [];
    list.push(p);
    strata.set(key, list);
  }
  const ordered = [...strata.entries()].sort((a, b) => a[0] - b[0]).map(([, members]) => members);
  const exact = ordered.map((m) => (count * m.length) / all.length);
  const quotas = exact.map(Math.floor);
  let rest = count - quotas.reduce((s, q) => s + q, 0);
  const byRemainder = ordered
    .map((m, i) => ({ i, frac: (exact[i] as number) - (quotas[i] as number), n: m.length }))
    .sort((a, b) => b.frac - a.frac || b.n - a.n || a.i - b.i);
  for (const { i } of byRemainder) {
    if (rest <= 0) break;
    quotas[i] = (quotas[i] as number) + 1;
    rest--;
  }
  const drawn: string[] = [];
  ordered.forEach((members, i) => drawn.push(...shuffle(members, rng).slice(0, quotas[i])));
  return drawn.sort(byString);
}

/**
 * Gruppi d'opinione di una run. Esistono solo in memoria: l'assegnazione
 * pseudo → gruppo è in un campo privato, non è enumerabile né serializzabile
 * (JSON.stringify restituisce solo k). Panel giuria e reputazione sono già in
 * `output.private`; qui resta solo il sorteggio stratificato (M8).
 *
 * ATTENZIONE: l'oggetto gruppi non deve mai uscire dalla run (né salvato, né
 * passato ad altri processi, né esposto via API): interrogandolo ripetutamente con
 * `drawStratified` su insiemi scelti si ricostruisce la partizione pseudo → gruppo.
 */
export class OpinionGroups {
  readonly #groupOf: ReadonlyMap<string, number>;
  readonly k: number;

  constructor(groupOf: ReadonlyMap<string, number>, k: number) {
    this.#groupOf = new Map(groupOf);
    this.k = k;
  }

  /**
   * Sorteggio stratificato dei curatori (M8), dentro la stessa run.
   * `seedString` è il seed pubblico (sha256(data + id ultima run)) calcolato fuori dal core.
   * Non chiamarlo su insiemi costruiti ad arte: vedi l'avvertenza sulla classe.
   */
  drawStratified(eligiblePseudos: readonly string[], seedString: string, count: number): string[] {
    return stratifiedDraw(this.#groupOf, eligiblePseudos, rngFromSeed(seedString), count);
  }

  toJSON(): { k: number } {
    return { k: this.k };
  }
}
