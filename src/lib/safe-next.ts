// Percorso di ritorno dopo il login (`?next=`): solo percorsi dello stesso sito.
// new URL normalizza tab, a capo e varianti codificate; si accetta solo se l'origine non cambia.
const BASE = "https://arengo.invalid";

export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE || !url.pathname.startsWith("/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
