import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { GuestNote } from "@/components/guest-note";
import { SearchFirstLink } from "@/components/search-first-link";
import { readNumbers, readRateLimits } from "@/lib/content/config";
import { LIMITS } from "@/lib/content/schemas";
import { getViewer } from "@/lib/content/viewer";
import { createProblem } from "./actions";

export const metadata: Metadata = { title: "Segnala un problema · Arengo" };

export default async function NuovoProblemaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, state } = await getViewer();
  const { data: topic } = await supabase.from("topics").select("id, slug, title").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!topic) notFound();
  const [limits, cfg] = await Promise.all([readRateLimits(supabase), readNumbers(supabase, ["problem_support_threshold"] as const)]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <nav>
        <Link href={`/temi/${topic.slug}`} className="underline">
          ‹ {topic.title}
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Segnala un problema</h1>
      <p className="text-grafite-2b">
        Descrivi un problema, non la soluzione. Si apre con {cfg.problem_support_threshold} sostegni; da lì si possono
        proporre soluzioni. Puoi segnalare {limits.problems} problema al giorno.
      </p>

      {state !== "complete" ? (
        <GuestNote state={state} next={`/temi/${topic.slug}/nuovo-problema`} action="segnalare un problema" />
      ) : (
        <ActionForm action={createProblem} submitLabel="Pubblica il problema">
          <input type="hidden" name="topic_id" value={topic.id} />
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">Passo 1 di 3 · Titolo</legend>
            <label htmlFor="title">In una frase, qual è il problema?</label>
            <input id="title" name="title" required maxLength={LIMITS.problemTitle} className="border border-filo p-2 font-serif text-lg" />
            <ul className="list-disc pl-5 text-sm text-grafite-2b">
              <li>È misurabile o verificabile?</li>
              <li>Evita aggettivi come &quot;vergognoso&quot; o &quot;assurdo&quot;?</li>
              <li>Non contiene già la soluzione?</li>
            </ul>
            <SearchFirstLink inputId="title" />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">Passo 2 di 3 · Descrizione</legend>
            <label htmlFor="body">Cosa succede, con fatti e numeri se li hai.</label>
            <textarea id="body" name="body" required maxLength={LIMITS.problemBody} rows={6} className="border border-filo p-2 font-serif text-lg" />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">Passo 3 di 3 · Chi riguarda</legend>
            <label htmlFor="affected">Chi ne subisce le conseguenze?</label>
            <textarea id="affected" name="affected" required maxLength={LIMITS.problemAffected} rows={3} className="border border-filo p-2 font-serif text-lg" />
          </fieldset>
        </ActionForm>
      )}
    </main>
  );
}
