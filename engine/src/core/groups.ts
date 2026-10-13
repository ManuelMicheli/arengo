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
 * Passo 8. Panel giuria disgiunti dagli idonei. Con k gruppi, ogni panel ha jury_size
 * membri da almeno min(jury_min_buckets, k) gruppi diversi (un membro da ciascuno dei
 * gruppi più numerosi, poi i posti restanti dal gruppo con più idonei rimasti); si
 * formano panel finché è possibile e gli idonei senza gruppo sono esclusi. Con k = 0
 * (run `insufficient`) i panel sono casuali e marcati diversity false.
 * Output: solo panel_id, diversity e membri in ordine alfabetico, nessuna etichetta.
 */
export function formJuryPanels(
  groupOf: ReadonlyMap<string, number>,
  k: number,
  eligible: readonly string[],
  config: Pick<EngineConfig, "jury_size" | "jury_min_buckets">,
  rng: Rng,
): JuryPanel[] {
  const size = config.jury_size;
  if (size < 1) return [];
  if (k === 0) return randomPanels(eligible, size, rng);
  const minBuckets = Math.min(config.jury_min_buckets, k);
  if (minBuckets > size) return [];
  const byGroup = new Map<number, string[]>();
  for (const p of uniqueSorted(eligible)) {
    const g = groupOf.get(p);
    if (g === undefined) continue;
    const list = byGroup.get(g) ?? [];
    list.push(p);
    byGroup.set(g, list);
  }
  const groupIds = [...byGroup.keys()].sort((a, b) => a - b);
  const buckets = groupIds.map((g) => shuffle(byGroup.get(g) as string[], rng));

  const largestFirst = (): number[] =>
    buckets
      .map((b, i) => ({ i, n: b.length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((x) => x.i);

  const panels: JuryPanel[] = [];
  for (;;) {
    const order = largestFirst();
    const remaining = buckets.reduce((s, b) => s + b.length, 0);
    if (order.length < minBuckets || remaining < size) break;
    const members: string[] = [];
    for (const i of order.slice(0, minBuckets)) members.push((buckets[i] as string[]).pop() as string);
    while (members.length < size) {
      const i = largestFirst()[0] as number;
      members.push((buckets[i] as string[]).pop() as string);
    }
    panels.push({ panel_id: panels.length + 1, diversity: true, members: members.sort(byString) });
  }
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
 * (JSON.stringify restituisce solo k). Espone solo operazioni che producono
 * output senza etichetta di gruppo. La reputazione si calcola dentro runEngine.
 */
export class OpinionGroups {
  readonly #groupOf: ReadonlyMap<string, number>;
  readonly k: number;

  constructor(groupOf: ReadonlyMap<string, number>, k: number) {
    this.#groupOf = new Map(groupOf);
    this.k = k;
  }

  /** Panel giuria (passo 8) con seed esplicito. */
  juryPanels(
    eligible: readonly string[],
    config: Pick<EngineConfig, "jury_size" | "jury_min_buckets">,
    seed: string,
  ): JuryPanel[] {
    return formJuryPanels(this.#groupOf, this.k, eligible, config, rngFromSeed(seed));
  }

  /** Sorteggio stratificato; `seedString` è il seed pubblico calcolato fuori dal core. */
  drawStratified(eligiblePseudos: readonly string[], seedString: string, count: number): string[] {
    return stratifiedDraw(this.#groupOf, eligiblePseudos, rngFromSeed(seedString), count);
  }

  toJSON(): { k: number } {
    return { k: this.k };
  }
}
