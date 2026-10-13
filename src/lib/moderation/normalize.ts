// Normalizzazione per il filtro: rende confrontabili testo e lessico nonostante caratteri invisibili,
// maiuscole, accenti, sostituzioni leet, lettere ripetute e lettere separate ("f.r.a.s.e").
// Il testo produce due forme di token: `plain` (nessuna fusione) e `joined` (lettere singole riunite);
// il filtro cerca i termini in entrambe, così la fusione non crea falsi positivi altrove.

import { HANDLE_CHARS, HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from "../handle";

export type Token = { text: string; mention: boolean };
export type NormalizedText = { plain: Token[]; joined: Token[] };

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

const MENTION_SRC = `@${HANDLE_CHARS}{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}}(?!${HANDLE_CHARS})`;
const TOKEN_RE = new RegExp(`${MENTION_SRC}|[a-z0-9@$]+`, "g");
const MENTION_RE = new RegExp(`^${MENTION_SRC}$`);

/** Senza caratteri invisibili (\p{Cf}: U+200B, U+00AD, U+2060, U+FEFF…), minuscole, senza diacritici. */
export function foldCase(text: string): string {
  return text.replace(/\p{Cf}/gu, "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}

/** Una parola: leet solo se contiene almeno una lettera; doppie ridotte solo sulle lettere. */
export function normalizeWord(raw: string): string {
  const word = /[a-z]/.test(raw) ? raw.replace(/[013457@$]/g, (c) => LEET[c] ?? c) : raw;
  return word.replace(/[^a-z0-9]/g, "").replace(/([a-z])\1+/g, "$1");
}

export function normalize(text: string, letterJoinMinRun: number): NormalizedText {
  const folded = foldCase(text);
  const raw: { token: Token; sepBefore: string }[] = [];
  let last = 0;
  for (const m of folded.matchAll(TOKEN_RE)) {
    const sepBefore = folded.slice(last, m.index);
    last = m.index + m[0].length;
    const mention = MENTION_RE.test(m[0]);
    const text = mention ? m[0] : normalizeWord(m[0]);
    if (text) raw.push({ token: { text, mention }, sepBefore });
  }

  const plain = raw.map((r) => r.token);
  const isSingleLetter = (t: Token) => !t.mention && /^[a-z]$/.test(t.text);
  const joined: Token[] = [];
  let i = 0;
  while (i < raw.length) {
    const first = raw[i];
    if (first && isSingleLetter(first.token)) {
      // Allunga la sequenza finché le lettere singole hanno tutte lo stesso separatore.
      let j = i + 1;
      const sep = raw[j]?.sepBefore;
      while (j < raw.length && isSingleLetter(raw[j]!.token) && raw[j]!.sepBefore === sep) j++;
      if (j - i >= letterJoinMinRun) {
        const word = raw
          .slice(i, j)
          .map((r) => r.token.text)
          .join("")
          .replace(/([a-z])\1+/g, "$1");
        joined.push({ text: word, mention: false });
        i = j;
        continue;
      }
    }
    if (first) joined.push(first.token);
    i++;
  }
  return { plain, joined };
}

/** Forma senza fusioni, come stringa: comoda per test e confronti. */
export function normalizeText(text: string, letterJoinMinRun = 3): string {
  return normalize(text, letterJoinMinRun)
    .plain.map((t) => t.text)
    .join(" ");
}

/** Forma con le lettere singole riunite, come stringa. */
export function normalizeJoinedText(text: string, letterJoinMinRun = 3): string {
  return normalize(text, letterJoinMinRun)
    .joined.map((t) => t.text)
    .join(" ");
}
