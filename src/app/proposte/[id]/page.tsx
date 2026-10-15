import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { GuestNote } from "@/components/guest-note";
import type { VoteValue } from "@/components/vote-buttons";
import { readRateLimits } from "@/lib/content/config";
import { loadArguments, loadResults } from "@/lib/content/results";
import { LIMITS, SOURCE_KIND_LABELS } from "@/lib/content/schemas";
import { getViewer } from "@/lib/content/viewer";
import { createArgument } from "./actions";
import { ArgumentRating } from "./argument-rating";
import { ProposalVote } from "./proposal-vote";

export const metadata: Metadata = { title: "Proposta · Arengo" };

const FIELDS = [
  { key: "how", label: "Come" },
  { key: "cost_and_funding", label: "Costo e copertura" },
  { key: "risks", label: "Rischi" },
] as const;

export default async function PropostaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuova?: string }>;
}) {
  const { id } = await params;
  const { nuova } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, state, seed } = await getViewer();

  const { data: p } = await supabase
    .from("proposals_public")
    .select("id, problem_id, what, how, cost_and_funding, risks, foreign_example, foreign_source_id, origin, status")
    .eq("id", id)
    .maybeSingle();
  if (!p?.id || p.status === "removed") notFound();

  const [problemRes, sourceRes, args, limits] = await Promise.all([
    supabase.from("problems_public").select("id, title").eq("id", p.problem_id!).maybeSingle(),
    p.foreign_source_id
      ? supabase.from("sources").select("url, title, kind").eq("id", p.foreign_source_id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadArguments(supabase, id, seed),
    readRateLimits(supabase),
  ]);
  const utilityRes = args.length
    ? await supabase
        .from("argument_utility")
        .select("argument_id, useful, not_useful, below_threshold")
        .in(
          "argument_id",
          args.map((a) => a.id),
        )
    : { data: [] };
  const utility = new Map((utilityRes.data ?? []).filter((u) => u.argument_id).map((u) => [u.argument_id!, u]));

  const canAct = state === "complete";
  let myVote: VoteValue | null = null;
  const myRatings = new Map<string, boolean>();
  if (canAct) {
    const { data } = await supabase.rpc("my_vote", { item_type: "proposal", item_id: id });
    if (data === 1 || data === 0 || data === -1) myVote = data;
    for (const a of args) {
      const { data: r } = await supabase.rpc("my_vote", { item_type: "argument", item_id: a.id });
      if (r === 1 || r === -1) myRatings.set(a.id, r === 1);
    }
  }
  const results = myVote !== null ? await loadResults(supabase, id, seed) : null;
  const pro = args.filter((a) => a.side === "pro");
  const contro = args.filter((a) => a.side === "contro");
  const source = sourceRes.data;

  const argumentList = (list: typeof args, title: string) => (
    <section className="flex flex-col gap-3">
      <h3 className="font-semibold">{title}</h3>
      {list.length === 0 ? (
        <p className="text-grafite-2b">Nessuno per ora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((a) => {
            const u = utility.get(a.id);
            return (
              <li key={a.id} className="flex flex-col gap-2 border-b border-filo pb-2">
                <p className="font-serif text-lg">{a.body}</p>
                <p className="text-sm text-grafite-2b tabular-nums">
                  {!u || u.below_threshold ? "Poche valutazioni per ora." : `Utile per ${u.useful}, non utile per ${u.not_useful}.`}
                </p>
                {canAct && <ArgumentRating argumentId={a.id} proposalId={id} initial={myRatings.get(a.id) ?? null} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      {problemRes.data && (
        <nav>
          <Link href={`/problemi/${problemRes.data.id}`} className="underline">
            ‹ {problemRes.data.title}
          </Link>
        </nav>
      )}
      {nuova === "1" && <p role="status">La tua proposta è pubblicata, senza il tuo nome.</p>}

      <article className="flex flex-col gap-4">
        <h1 className="font-serif text-3xl">{p.what}</h1>
        {FIELDS.map((f) => (
          <section key={f.key} className="flex flex-col gap-1">
            <h2 className="text-sm text-grafite-2b">{f.label}</h2>
            <p className="font-serif text-lg whitespace-pre-line">{p[f.key]}</p>
          </section>
        ))}
        {p.foreign_example && (
          <section className="flex flex-col gap-1">
            <h2 className="text-sm text-grafite-2b">Esempio estero</h2>
            <p className="font-serif text-lg whitespace-pre-line">{p.foreign_example}</p>
            {source && (
              <p className="text-sm text-grafite-2b">
                Fonte ({SOURCE_KIND_LABELS[source.kind as keyof typeof SOURCE_KIND_LABELS] ?? source.kind}):{" "}
                <a href={source.url} rel="noopener noreferrer nofollow" target="_blank" className="underline">
                  {source.title}
                </a>
              </p>
            )}
          </section>
        )}
        <p className="text-sm text-grafite-2b">A matita: il consenso tra i gruppi si calcola ogni notte.</p>
      </article>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Il tuo voto</h2>
        {p.status !== "open" ? (
          <p>Questa proposta non accetta più voti.</p>
        ) : canAct ? (
          <ProposalVote proposalId={id} initial={myVote} initialResults={results} />
        ) : (
          <GuestNote state={state} next={`/proposte/${id}`} action="votare" />
        )}
        <p className="text-sm text-grafite-2b">Nessuno vede come hai votato: contano solo i totali.</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Argomenti</h2>
        {argumentList(pro, "A favore")}
        {argumentList(contro, "Contro")}
        {canAct && p.status === "open" ? (
          <ActionForm action={createArgument} submitLabel="Aggiungi l'argomento" successMessage="Argomento aggiunto.">
            <input type="hidden" name="proposal_id" value={id} />
            <fieldset className="flex gap-4">
              <legend className="font-semibold">Aggiungi un argomento ({limits.arguments} al giorno)</legend>
              <label className="flex gap-2">
                <input type="radio" name="side" value="pro" required /> A favore
              </label>
              <label className="flex gap-2">
                <input type="radio" name="side" value="contro" /> Contro
              </label>
            </fieldset>
            <label htmlFor="argument-body" className="flex flex-col gap-1">
              Il tuo argomento
              <textarea id="argument-body" name="body" required maxLength={LIMITS.argumentBody} rows={3} className="border border-filo p-2 font-serif text-lg" />
            </label>
          </ActionForm>
        ) : (
          <GuestNote state={state} next={`/proposte/${id}`} action="aggiungere un argomento" />
        )}
      </section>
    </main>
  );
}
