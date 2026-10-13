#!/usr/bin/env node
// Esegue typecheck/lint/test solo dei pacchetti toccati rispetto a origin/main (o main),
// includendo modifiche non committate e file non tracciati.
import { execFileSync, execSync } from "node:child_process";

const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return null;
  }
};

const base = ["origin/main", "main"].find((ref) => git(["rev-parse", "--verify", "--quiet", ref]) !== null);
const changed = new Set([
  ...(base ? (git(["diff", "--name-only", `${base}...HEAD`]) ?? []) : []),
  ...(git(["diff", "--name-only", "HEAD"]) ?? []),
  ...(git(["ls-files", "--others", "--exclude-standard"]) ?? []),
]);

const files = [...changed];
const engine = files.some((f) => f.startsWith("engine/"));
const db = files.some((f) => f.startsWith("supabase/"));
const app = files.some((f) => !f.startsWith("engine/") && !f.startsWith("supabase/") && !f.startsWith("docs/") && !f.endsWith(".md"));

const steps = [];
if (app) steps.push("pnpm exec next typegen", "pnpm exec tsc --noEmit", "pnpm exec vitest run");
if (app || engine) steps.push("pnpm lint");
if (engine) steps.push("pnpm --filter engine typecheck", "pnpm --filter engine test");
if (app || engine) steps.push("pnpm ai:check");

console.log(`Base: ${base ?? "nessuna"} · file cambiati: ${files.length} · app=${app} engine=${engine} db=${db}`);
if (db) console.log("supabase/ modificato: i test pgTAP girano solo in CI (job db).");
if (steps.length === 0) {
  console.log("Niente da controllare.");
  process.exit(0);
}
for (const step of steps) {
  console.log(`\n> ${step}`);
  execSync(step, { stdio: "inherit" });
}
