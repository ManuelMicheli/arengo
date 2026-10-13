// checkContent: funzione pura. Testo + lessico in ingresso, esito in uscita; nessun I/O, nessun log.
// Livelli della Scala di severità (docs/BRIEF.md): 2 insulto a utente, 3 insulto d'odio, 4 illecito.
// Livello 2 blocca solo se il termine è rivolto a una persona; 3 e 4 bloccano sempre.
// Un'etichetta politica descrittiva non è nel lessico: passa ("è una proposta comunista").

import { foldCase, normalizeText } from "./normalize";

export type SeverityLevel = 2 | 3 | 4;

export type LexiconEntry = {
  term: string;
  level: SeverityLevel;
  isPattern: boolean;
};

export type RuleId = "insulto_a_utente" | "insulto_odio" | "contenuto_illecito";

export type CheckResult = { ok: true } | { ok: false; level: SeverityLevel; rule: RuleId };

const RULE_BY_LEVEL: Record<SeverityLevel, RuleId> = {
  2: "insulto_a_utente",
  3: "insulto_odio",
  4: "contenuto_illecito",
};

// Formule che rivolgono il testo a una persona (sul testo normalizzato).
const TARGETING = /(?:^| )(?:tu sei|sei (?:un|una|uno)|vai a)(?: |$)/;
// Menzione di un handle (sul testo senza leet, perché "@" in leet vale "a").
const MENTION = /(?:^|[^a-z0-9_])@[a-z0-9_]{3,20}/;

type Compiled = { level: SeverityLevel; test: (normalized: string) => boolean };

function compile(entry: LexiconEntry): Compiled | null {
  if (entry.isPattern) {
    try {
      const re = new RegExp(entry.term, "u");
      return { level: entry.level, test: (n) => re.test(n) };
    } catch {
      return null; // pattern non valido: ignorato (va corretto nel lessico)
    }
  }
  const term = normalizeText(entry.term);
  if (!term) return null;
  const needle = ` ${term} `;
  return { level: entry.level, test: (n) => ` ${n} `.includes(needle) };
}

export function isTargetingPerson(text: string): boolean {
  return TARGETING.test(normalizeText(text)) || MENTION.test(foldCase(text));
}

export function checkContent(text: string, context: { lexicon: readonly LexiconEntry[] }): CheckResult {
  const normalized = normalizeText(text);
  if (!normalized) return { ok: true };

  const matched = new Set<SeverityLevel>();
  for (const entry of context.lexicon) {
    const c = compile(entry);
    if (c && c.test(normalized)) matched.add(c.level);
  }

  for (const level of [4, 3] as const) {
    if (matched.has(level)) return { ok: false, level, rule: RULE_BY_LEVEL[level] };
  }
  if (matched.has(2) && isTargetingPerson(text)) {
    return { ok: false, level: 2, rule: RULE_BY_LEVEL[2] };
  }
  return { ok: true };
}
