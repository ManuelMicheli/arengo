import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { GuestNote } from "@/components/guest-note";
import { readRateLimits } from "@/lib/content/config";
import { LIMITS } from "@/lib/content/schemas";
import { proposeReformulation } from "../actions";
import { loadProblemForWriting } from "../load";

export const metadata: Metadata = { title: "Riformula · Arengo" };

export default async function RiformulaPage({ params }: { params: Promise<{ id: string }> }) {
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
      <h1 className="text-2xl font-semibold">Pensi che si possa dire meglio, in modo più neutro?</h1>
      <p className="text-grafite-2b">
        Scrivi una versione alternativa: gli altri voteranno quale preferiscono. Puoi proporne {limits.reformulations} al
        giorno.
      </p>
      <section className="text-grafite-2b">
        <p className="text-sm">Testo attuale</p>
        <p className="font-serif text-lg">{problem.title}</p>
      </section>
      {state !== "complete" ? (
        <GuestNote state={state} next={`/problemi/${id}/riformula`} action="proporre una riformulazione" />
      ) : (
        <ActionForm action={proposeReformulation} submitLabel="Proponi la riformulazione">
          <input type="hidden" name="problem_id" value={problem.id} />
          <label htmlFor="title" className="flex flex-col gap-1">
            Titolo
            <input id="title" name="title" required defaultValue={problem.title} maxLength={LIMITS.problemTitle} className="border border-filo p-2 font-serif text-lg" />
          </label>
          <label htmlFor="body" className="flex flex-col gap-1">
            Descrizione
            <textarea id="body" name="body" required defaultValue={problem.body} maxLength={LIMITS.problemBody} rows={6} className="border border-filo p-2 font-serif text-lg" />
          </label>
        </ActionForm>
      )}
    </main>
  );
}
