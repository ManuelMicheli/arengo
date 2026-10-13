// Normalizzazione per il filtro: rende confrontabili testo e lessico nonostante maiuscole, accenti,
// sostituzioni leet, lettere ripetute e lettere separate ("f.r.a.s.e" → "frase").
// Termini del lessico e testo passano dalla stessa funzione.

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

/** Minuscole + niente segni diacritici (NFKD), senza leet. Usata per riconoscere le menzioni. */
export function foldCase(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}

/** Normalizzazione completa: token alfanumerici separati da uno spazio. */
export function normalizeText(text: string): string {
  const folded = foldCase(text).replace(/[013457@$]/g, (c) => LEET[c] ?? c);
  const tokens = folded
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.replace(/([a-z0-9])\1+/g, "$1"));

  // Lettere singole consecutive (almeno 3) diventano una parola: "f r a s e" → "frase".
  const merged: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) merged.push(run.join("").replace(/([a-z0-9])\1+/g, "$1"));
    else merged.push(...run);
    run = [];
  };
  for (const t of tokens) {
    if (t.length === 1) run.push(t);
    else {
      flush();
      merged.push(t);
    }
  }
  flush();
  return merged.join(" ");
}
