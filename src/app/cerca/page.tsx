import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Cerca · Arengo" };

const KIND_LABEL = { problem: "Problema", fact: "Scheda", proposal: "Proposta" } as const;
const MAX_QUERY = 200;

// Ricerca full-text in italiano (search_content, solo service role: nessuna funzione è eseguibile da anon).
// Restituisce solo campi già pubblici; l'Agenda si aggiunge in M9.
export default async function CercaPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_QUERY) ?? "";
  let results: { kind: string; id: string; problem_id: string; title: string }[] = [];
  let failed = false;
  if (q) {
    const { data, error } = await createServiceClient().rpc("search_content", { q });
    failed = !!error;
    results = data ?? [];
  }
  const href = (r: (typeof results)[number]) => (r.kind === "proposal" ? `/proposte/${r.id}` : `/problemi/${r.problem_id}`);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Cerca</h1>
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Cosa cerchi
        </label>
        <input id="q" name="q" type="search" defaultValue={q} maxLength={MAX_QUERY} className="flex-1 border border-filo p-2" placeholder="Problemi, schede, proposte" />
        <button type="submit" className="border border-filo px-4 py-2">
          Cerca
        </button>
      </form>
      {failed && <p role="alert">La ricerca non è disponibile in questo momento. Riprova tra poco.</p>}
      {q && !failed && results.length === 0 && <p>Nessun risultato per &quot;{q}&quot;. Prova con parole diverse.</p>}
      {results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {results.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <p className="text-sm text-grafite-2b">{KIND_LABEL[r.kind as keyof typeof KIND_LABEL] ?? r.kind}</p>
              <Link href={href(r)} className="font-serif text-lg underline">
                {r.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
