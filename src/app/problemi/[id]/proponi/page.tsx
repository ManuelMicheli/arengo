import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { GuestNote } from "@/components/guest-note";
import { readRateLimits } from "@/lib/content/config";
import { LIMITS, SOURCE_KIND_LABELS, SOURCE_KINDS } from "@/lib/content/schemas";
import { createProposal } from "../actions";
import { loadProblemForWriting } from "../load";

export const metadata: Metadata = { title: "Proponi una soluzione · Arengo" };

const STEPS = [
  { name: "what", label: "Cosa", help: "In una frase, cosa proponi?", max: LIMITS.proposalWhat, rows: 2 },
  { name: "how", label: "Come", help: "Come si realizza, in concreto?", max: LIMITS.proposalHow, rows: 6 },
  { name: "cost_and_funding", label: "Costo e copertura", help: "Quanto costa e chi paga?", max: LIMITS.proposalCost, rows: 4 },
  { name: "risks", label: "Rischi", help: "Cosa potrebbe andare storto?", max: LIMITS.proposalRisks, rows: 4 },
] as const;

export default async function ProponiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, state, problem } = await loadProblemForWriting(id);
  const limits = await readRateLimits(supabase);
  const open = problem.status === "active";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <nav>
        <Link href={`/problemi/${id}`} className="underline">
          ‹ Problema
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Proponi una soluzione</h1>
      <p className="font-serif text-lg">{problem.title}</p>
      <p className="text-grafite-2b">
        La proposta si pubblica senza il tuo nome. Puoi scriverne {limits.proposals} al giorno.
      </p>
      {!open ? (
        <p>Si possono proporre soluzioni solo ai problemi aperti. Questo è ancora in raccolta di sostegni.</p>
      ) : state !== "complete" ? (
        <GuestNote state={state} next={`/problemi/${id}/proponi`} action="proporre una soluzione" />
      ) : (
        <ActionForm action={createProposal} submitLabel="Pubblica la proposta">
          <input type="hidden" name="problem_id" value={problem.id} />
          {STEPS.map((s, i) => (
            <fieldset key={s.name} className="flex flex-col gap-2">
              <legend className="font-semibold">
                Passo {i + 1} di 5 · {s.label}
              </legend>
              <label htmlFor={s.name}>{s.help}</label>
              <textarea id={s.name} name={s.name} required maxLength={s.max} rows={s.rows} className="border border-filo p-2 font-serif text-lg" />
            </fieldset>
          ))}
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">Passo 5 di 5 · Esempio estero (facoltativo)</legend>
            <label htmlFor="foreign_example">Un altro Paese ha fatto qualcosa di simile? Se lo citi, indica la fonte.</label>
            <textarea id="foreign_example" name="foreign_example" maxLength={LIMITS.proposalForeign} rows={3} className="border border-filo p-2 font-serif text-lg" />
            <label htmlFor="foreign_source_url" className="flex flex-col gap-1">
              Indirizzo della fonte
              <input id="foreign_source_url" name="foreign_source_url" type="url" maxLength={LIMITS.sourceUrl} className="border border-filo p-2" />
            </label>
            <label htmlFor="foreign_source_title" className="flex flex-col gap-1">
              Titolo della fonte
              <input id="foreign_source_title" name="foreign_source_title" maxLength={LIMITS.sourceTitle} className="border border-filo p-2" />
            </label>
            <label htmlFor="foreign_source_kind" className="flex flex-col gap-1">
              Tipo di fonte
              <select id="foreign_source_kind" name="foreign_source_kind" defaultValue="" className="border border-filo p-2">
                <option value="">Nessuna</option>
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
