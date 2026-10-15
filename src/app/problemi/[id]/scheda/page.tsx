import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { GuestNote } from "@/components/guest-note";
import { readRateLimits } from "@/lib/content/config";
import { LIMITS, SOURCE_KIND_LABELS, SOURCE_KINDS } from "@/lib/content/schemas";
import { proposeFact } from "../actions";
import { loadProblemForWriting } from "../load";

export const metadata: Metadata = { title: "Aggiungi una scheda · Arengo" };

export default async function SchedaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, state, problem } = await loadProblemForWriting(id);
  const limits = await readRateLimits(supabase);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <nav>
        <Link href={`/problemi/${id}`} className="underline">
          ‹ Problema
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Aggiungi un fatto con la sua fonte</h1>
      <p className="text-grafite-2b">
        Un fatto verificabile su &quot;{problem.title}&quot;. Diventa visibile dopo il controllo dei curatori. Puoi
        aggiungerne {limits.facts} al giorno.
      </p>
      {state !== "complete" ? (
        <GuestNote state={state} next={`/problemi/${id}/scheda`} action="aggiungere una scheda" />
      ) : (
        <ActionForm
          action={proposeFact}
          submitLabel="Invia la scheda"
          successMessage="Grazie: la scheda è in attesa del controllo dei curatori."
        >
          <input type="hidden" name="problem_id" value={problem.id} />
          <label htmlFor="statement" className="flex flex-col gap-1">
            Il fatto
            <textarea id="statement" name="statement" required maxLength={LIMITS.factStatement} rows={4} className="border border-filo p-2 font-serif text-lg" />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">Fonte (obbligatoria)</legend>
            <label htmlFor="source_url" className="flex flex-col gap-1">
              Indirizzo web
              <input id="source_url" name="source_url" type="url" required maxLength={LIMITS.sourceUrl} className="border border-filo p-2" />
            </label>
            <label htmlFor="source_title" className="flex flex-col gap-1">
              Titolo del documento
              <input id="source_title" name="source_title" required maxLength={LIMITS.sourceTitle} className="border border-filo p-2" />
            </label>
            <label htmlFor="source_publisher" className="flex flex-col gap-1">
              Chi lo pubblica (facoltativo)
              <input id="source_publisher" name="source_publisher" maxLength={LIMITS.sourceTitle} className="border border-filo p-2" />
            </label>
            <label htmlFor="source_kind" className="flex flex-col gap-1">
              Tipo di fonte
              <select id="source_kind" name="source_kind" required defaultValue="" className="border border-filo p-2">
                <option value="" disabled>
                  Scegli
                </option>
                {SOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        </ActionForm>
      )}
    </main>
  );
}
