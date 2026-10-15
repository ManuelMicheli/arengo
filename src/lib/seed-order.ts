// Ordine casuale ma stabile per utente (seed di sessione nel cookie `arengo_seed`): stesso seed → stesso ordine.
// Serve a non premiare chi pubblica per primo (proposte e argomenti prima della run del motore).
import { createHash } from "node:crypto";

export { SEED_COOKIE } from "./seed-cookie";

const rank = (seed: string, id: string) => createHash("sha256").update(`${seed}:${id}`).digest("hex");

export function seededOrder<T extends { id: string }>(items: readonly T[], seed: string): T[] {
  return [...items]
    .map((item) => ({ item, key: rank(seed, item.id) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ item }) => item);
}
