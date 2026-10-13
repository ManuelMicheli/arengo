// checkContent: funzione pura. Testo + lessico + parametri in ingresso, esito in uscita; nessun I/O, nessun log.
// Livelli della Scala di severità (docs/BRIEF.md): 2 insulto a utente, 3 insulto d'odio, 4 illecito.
// Livello 2 blocca solo se una formula rivolta a una persona è entro `targetWindowWords` parole dal termine;
// 3 e 4 bloccano sempre. Le etichette politiche, se nel lessico, stanno a livello 2 (vedi docs/LESSICO.md).
// Nessuna RegExp costruita dal lessico: le frasi si confrontano parola per parola (`*` = una parola qualsiasi).

import { normalize, normalizeWord, type Token } from "./normalize";

export type SeverityLevel = 2 | 3 | 4;

export type LexiconEntry = { term: string; level: SeverityLevel };

export type FilterParams = {
  /** filter_target_window_words */
  targetWindowWords: number;
  /** filter_letter_join_min_run */
  letterJoinMinRun: number;
};

export type RuleId = "insulto_a_utente" | "insulto_odio" | "contenuto_illecito";

export type CheckResult = { ok: true } | { ok: false; level: SeverityLevel; rule: RuleId };

const RULE_BY_LEVEL: Record<SeverityLevel, RuleId> = {
  2: "insulto_a_utente",
  3: "insulto_odio",
  4: "contenuto_illecito",
};

const WILDCARD = null;
type Phrase = (string | typeof WILDCARD)[];
type Span = { start: number; end: number };

function compilePhrase(phrase: string): Phrase | null {
  const words = phrase
    .trim()
    .split(/\s+/)
    .map((w) => (w === "*" ? WILDCARD : normalizeWord(w)));
  if (words.some((w) => w === "") || !words.some((w) => w !== WILDCARD)) return null;
  return words;
}

/** Tutte le occorrenze della frase nei token (confronto lineare, niente backtracking). */
function findPhrase(tokens: readonly Token[], phrase: Phrase): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i + phrase.length <= tokens.length; i++) {
    let ok = true;
    for (let k = 0; k < phrase.length; k++) {
      const t = tokens[i + k]!;
      const p = phrase[k];
      if (t.mention || (p !== WILDCARD && t.text !== p)) {
        ok = false;
        break;
      }
    }
    if (ok) spans.push({ start: i, end: i + phrase.length - 1 });
  }
  return spans;
}

// Formule rivolte a una persona. "sei <termine>" è gestita a parte (solo subito prima del termine).
const TARGETING: Phrase[] = [
  "tu sei",
  "voi siete",
  "sei un",
  "sei una",
  "sei uno",
  "sei proprio un",
  "sei proprio una",
  "sei solo un",
  "sei solo una",
  "siete dei",
  "siete delle",
  "vai a",
].map((f) => compilePhrase(f)!);
const SEI = normalizeWord("sei");

const gap = (a: Span, b: Span) => Math.max(0, b.start - a.end - 1, a.start - b.end - 1);

function isTargeted(tokens: readonly Token[], term: Span, window: number): boolean {
  if (term.start > 0 && tokens[term.start - 1]?.text === SEI) return true;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.mention && gap({ start: i, end: i }, term) <= window) return true;
  }
  return TARGETING.some((f) => findPhrase(tokens, f).some((s) => gap(s, term) <= window));
}

type CompiledEntry = { level: SeverityLevel; phrase: Phrase };
const compiledCache = new WeakMap<readonly LexiconEntry[], CompiledEntry[]>();

/** Compila il lessico una volta per versione (stesso array → stessa forma compilata). */
export function compileLexicon(lexicon: readonly LexiconEntry[]): CompiledEntry[] {
  const cached = compiledCache.get(lexicon);
  if (cached) return cached;
  const compiled = lexicon.flatMap((e) => {
    const phrase = compilePhrase(e.term);
    return phrase ? [{ level: e.level, phrase }] : [];
  });
  compiledCache.set(lexicon, compiled);
  return compiled;
}

export function checkContent(
  text: string,
  context: { lexicon: readonly LexiconEntry[]; params: FilterParams },
): CheckResult {
  const { plain, joined } = normalize(text, context.params.letterJoinMinRun);
  if (plain.length === 0) return { ok: true };
  const entries = compileLexicon(context.lexicon);

  let worst: SeverityLevel | null = null;
  for (const tokens of [plain, joined]) {
    for (const e of entries) {
      if (e.level === 2) {
        const targeted = findPhrase(tokens, e.phrase).some((s) =>
          isTargeted(tokens, s, context.params.targetWindowWords),
        );
        if (targeted && worst === null) worst = 2;
      } else if (findPhrase(tokens, e.phrase).length > 0 && (worst === null || e.level > worst)) {
        worst = e.level;
      }
    }
  }
  return worst === null ? { ok: true } : { ok: false, level: worst, rule: RULE_BY_LEVEL[worst] };
}
