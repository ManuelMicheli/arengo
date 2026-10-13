import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SEED_CONFIG } from "./fixtures";

// Legge il seed di platform_config dalle migrazioni (solo nel test: il core non tocca il filesystem).
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");

function seedFromMigrations(): Map<string, unknown> {
  const seed = new Map<string, unknown>();
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    const inserts = sql.matchAll(/insert into public\.platform_config \(key, value\) values([\s\S]*?);/gi);
    for (const [, body] of inserts) {
      for (const [, key, raw] of (body ?? "").matchAll(/\('([a-z0-9_]+)',\s*'((?:[^']|'')*)'\)/g)) {
        seed.set(key as string, JSON.parse((raw as string).replace(/''/g, "'")));
      }
    }
  }
  return seed;
}

// Non ancora nel seed: le aggiunge la migrazione di M6 (task 6.1).
const PENDING_M6 = new Set(["reputation_cross_credit", "reputation_same_credit", "min_cluster_share"]);

describe("SEED_CONFIG coincide con il seed di platform_config nelle migrazioni", () => {
  const seed = seedFromMigrations();

  it("il seed è stato trovato", () => {
    expect(seed.size).toBeGreaterThan(20);
  });

  for (const [key, value] of Object.entries(SEED_CONFIG)) {
    if (PENDING_M6.has(key)) continue;
    it(`${key} = ${value}`, () => {
      expect(seed.has(key), `${key} assente dal seed`).toBe(true);
      expect(seed.get(key)).toBe(value);
    });
  }

  it("le chiavi in attesa di M6 non sono ancora nel seed (togliere da PENDING_M6 quando arrivano)", () => {
    for (const key of PENDING_M6) expect(seed.has(key)).toBe(false);
  });
});
