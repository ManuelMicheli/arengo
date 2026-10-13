#!/usr/bin/env node
// Genera .ai/mappa-codice.md: file → export, rotte, tabelle, file grandi da non leggere interi.
// Output deterministico (nessun timestamp, ordine stabile, LF) così `--check` è affidabile in CI.
// Uso: node scripts/ai-map.mjs [--check] [--quiet]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = ".ai/mappa-codice.md";
const CODE_RE = /\.(ts|tsx|mjs|js)$/;
const CODE_DIRS = ["src/", "engine/src/", "engine/test/", "scripts/"];
const LARGE_LINES = 600;
const LARGE_BYTES = 40_000;
const ALWAYS_LARGE = ["pnpm-lock.yaml", "src/types/database.ts"];

const read = (rel) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

export function listFiles() {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return [...new Set(out.split("\0").filter(Boolean))]
    .filter((f) => existsSync(join(ROOT, f)) && f !== OUT)
    .sort();
}

export function extractExports(source) {
  const names = new Set();
  const decl =
    /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
  for (const m of source.matchAll(decl)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  if (/^export\s+default\s+(?!async\s|function|class|const|let|var|type|interface|enum)/m.test(source)) {
    names.add("default");
  }
  return [...names].sort();
}

// src/app/(auth)/login/page.tsx → /login ; src/app/api/x/route.ts → /api/x (route)
export function routeFromFile(file) {
  const m = file.match(/^src\/app\/((?:.+\/)?)(page|route)\.(tsx|ts|jsx|js)$/);
  if (!m) return null;
  const segments = m[1]
    .split("/")
    .filter(Boolean)
    .filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  return { path: "/" + segments.join("/"), kind: m[2] };
}

export function extractTables(sql) {
  const tables = new Set();
  const re = /create\s+(?:table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?("?[\w]+"?\.)?"?([\w]+)"?/gi;
  for (const m of sql.matchAll(re)) {
    const schema = (m[1] ?? "public.").replace(/"/g, "").replace(/\.$/, "");
    tables.add(`${schema}.${m[2]}`);
  }
  return [...tables];
}

export function buildMap(files) {
  const lines = [
    "# Mappa del codice",
    "",
    "Generata da `pnpm ai:map`: non modificare a mano. Consultare solo con Grep.",
    "",
  ];

  const routes = files.map((f) => ({ f, r: routeFromFile(f) })).filter((x) => x.r);
  lines.push("## Rotte", "");
  if (routes.length === 0) lines.push("_nessuna_");
  for (const { f, r } of routes) lines.push(`- \`${r.path}\` (${r.kind}) → ${f}`);
  lines.push("");

  const migrations = files.filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f));
  lines.push("## Tabelle e viste (da migrazioni)", "");
  const tableRows = [];
  for (const f of migrations) for (const t of extractTables(read(f))) tableRows.push(`- \`${t}\` → ${f}`);
  if (tableRows.length === 0) lines.push("_nessuna_");
  lines.push(...tableRows.sort(), "");

  const code = files.filter((f) => CODE_RE.test(f) && CODE_DIRS.some((d) => f.startsWith(d)) && !f.endsWith(".d.ts"));
  lines.push("## File → export", "");
  for (const f of code) {
    const exp = extractExports(read(f));
    lines.push(`- ${f}${exp.length ? ": " + exp.join(", ") : ""}`);
  }
  lines.push("");

  lines.push(`## File grandi (non leggere interi: Grep o Read con offset/limit)`, "");
  const large = new Set(ALWAYS_LARGE.filter((f) => files.includes(f)));
  for (const f of files) {
    if (/\.(woff2?|png|jpe?g|ico|svg)$/.test(f)) continue;
    const size = statSync(join(ROOT, f)).size;
    if (size > 2_000_000) {
      large.add(f);
      continue;
    }
    const text = read(f);
    if (Buffer.byteLength(text) > LARGE_BYTES || text.split("\n").length > LARGE_LINES) large.add(f);
  }
  if (large.size === 0) lines.push("_nessuno_");
  for (const f of [...large].sort()) lines.push(`- ${f}`);
  lines.push("");

  return lines.join("\n");
}

function main() {
  const args = new Set(process.argv.slice(2));
  const map = buildMap(listFiles());
  const outPath = join(ROOT, OUT);
  const current = existsSync(outPath) ? readFileSync(outPath, "utf8").replace(/\r\n/g, "\n") : null;

  if (args.has("--check")) {
    if (current !== map) {
      console.error(`${OUT} non aggiornata: esegui \`pnpm ai:map\` e committa.`);
      process.exit(1);
    }
    if (!args.has("--quiet")) console.log(`${OUT} aggiornata.`);
    return;
  }
  if (current !== map) writeFileSync(outPath, map);
  if (!args.has("--quiet")) console.log(`${relative(ROOT, outPath)} ${current === map ? "invariata" : "rigenerata"}.`);
}

// Avvio come CLI: confronto tra percorsi normalizzati (Windows: lettera di unità e separatori variano
// tra `node scripts/...`, `D:\...` e `/d/...` passato da Git Bash).
export function isEntrypoint(argv1, moduleUrl = import.meta.url, platform = process.platform) {
  if (!argv1) return false;
  const win = platform === "win32";
  const norm = (p) => {
    const s = (win ? p.replace(/^\/([a-zA-Z])\//, "$1:/") : p).replace(/\\/g, "/");
    return win ? s.toLowerCase() : s;
  };
  return norm(resolve(norm(argv1))) === norm(fileURLToPath(moduleUrl));
}

if (isEntrypoint(process.argv[1])) main();
