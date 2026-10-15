// Testi legali da content/legal/*.md, resi come blocchi semplici (titoli, elenchi, paragrafi; **grassetto**).
// Nessun parser Markdown: i testi sono nostri e il formato è volutamente ristretto.
import { readFile } from "node:fs/promises";
import path from "node:path";

export type LegalDoc = "regole" | "consenso-art9" | "privacy";
export type LegalBlock =
  | { kind: "h1" | "h2" | "p"; text: string }
  | { kind: "ul"; items: string[] };

export function parseLegal(md: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const chunk of md.split(/\r?\n\s*\r?\n/)) {
    const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ kind: "ul", items: lines.map((l) => l.slice(2)) });
    } else if (lines[0]!.startsWith("## ")) {
      blocks.push({ kind: "h2", text: lines.join(" ").slice(3) });
    } else if (lines[0]!.startsWith("# ")) {
      blocks.push({ kind: "h1", text: lines.join(" ").slice(2) });
    } else {
      blocks.push({ kind: "p", text: lines.join(" ") });
    }
  }
  return blocks;
}

export async function loadLegal(doc: LegalDoc): Promise<LegalBlock[]> {
  return parseLegal(await readFile(path.join(process.cwd(), "content", "legal", `${doc}.md`), "utf8"));
}
