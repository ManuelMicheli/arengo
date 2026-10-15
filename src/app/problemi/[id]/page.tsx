import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { GuestNote } from "@/components/guest-note";
import { readNumbers } from "@/lib/content/config";
import { SOURCE_KIND_LABELS } from "@/lib/content/schemas";
import { getViewer } from "@/lib/content/viewer";
import { seededOrder } from "@/lib/seed-order";
import { ReformulationVote, SupportButton } from "./problem-buttons";

export const metadata: Metadata = { title: "Problema · Arengo" };

const dateRome = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" });

export default async function ProblemaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuovo?: string }>;
}) {
  const { id } = await params;
  const { nuovo } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, state, seed } = await getViewer();

  const { data: problem } = await supabase
    .from("problems_public")
    .select("id, topic_id, title, body, affected, status, activated_at")
    .eq("id", id)
    .maybeSingle();
  if (!problem || !problem.id || problem.status === "removed") notFound();

  const [topicRes, tallyRes, factsRes, refsRes, revRes, propsRes, cfg] = await Promise.all([
    supabase.from("topics").select("slug, title").eq("id", problem.topic_id!).maybeSingle(),
    supabase.from("problem_support_tallies").select("supports, below_threshold").eq("problem_id", id).maybeSingle(),
    supabase
      .from("problem_facts")
      .select("id, statement, source:sources(url, title, publisher, kind)")
      .eq("problem_id", id)
      .eq("status", "approved")
      .order("created_at"),
    supabase
      .from("problem_reformulations")
      .select("id, title, body, created_at")
      .eq("problem_id", id)
      .eq("status", "open")
      .order("created_at"),
    supabase.from("problem_revisions").select("id, title, body, replaced_at").eq("problem_id", id).order("replaced_at", { ascending: false }),
    supabase.from("proposals_public").select("id, what").eq("problem_id", id).eq("status", "open"),
    readNumbers(supabase, ["problem_support_threshold", "min_votes_item", "reformulation_min_votes"] as const),
  ]);
  const topic = topicRes.data;
  const tally = tallyRes.data;
  const reformulations = refsRes.data ?? [];
  const proposals = seededOrder(
    (propsRes.data ?? []).filter((p): p is { id: string; what: string } => !!p.id && !!p.what),
    seed,
  );

  const canAct = state === "complete";
  let supported = false;
  const myRefVotes = new Map<string, 1 | -1>();
  if (canAct) {
    const { data } = await supabase.rpc("my_vote", { item_type: "problem", item_id: id });
    supported = data === 1;
    for (const r of reformulations) {
      const { data: v } = await supabase.rpc("my_vote", { item_type: "reformulation", item_id: r.id });
      if (v === 1 || v === -1) myRefVotes.set(r.id, v);
    }
  }
  const refTallies = new Map<string, { prefer_new: number | null; prefer_current: number | null; below_threshold: boolean | null }>();
  if (reformulations.length) {
    const { data } = await supabase
      .from("reformulation_tallies")
      .select("reformulation_id, prefer_new, prefer_current, below_threshold")
      .in(
        "reformulation_id",
        reformulations.map((r) => r.id),
      );
    for (const t of data ?? []) if (t.reformulation_id) refTallies.set(t.reformulation_id, t);
  }

  const isActive = problem.status === "active";
  const supportsText =
    !tally || tally.below_threshold || tally.supports === null
      ? `Meno di ${cfg.min_votes_item} sostegni finora.`
      : `${tally.supports} sostegni.`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      {topic && (
        <nav>
          <Link href={`/temi/${topic.slug}`} className="underline">
            ‹ {topic.title}
          </Link>
        </nav>
      )}
      {nuovo === "1" && (
        <p role="status">Il tuo problema è in raccolta. Si apre con {cfg.problem_support_threshold} sostegni.</p>
      )}

      <article className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl">{problem.title}</h1>
        <p className="font-serif text-lg whitespace-pre-line">{problem.body}</p>
        <p className="font-serif text-lg">
          <span className="font-sans text-sm text-grafite-2b">Chi riguarda: </span>
          {problem.affected}
        </p>
      </article>

      <section className="flex flex-col gap-2" aria-label="Stato">
        {isActive ? (
          <p className="text-sm text-grafite-2b">
            Aperto{problem.activated_at ? ` dal ${dateRome.format(new Date(problem.activated_at))}` : ""}: si possono proporre
            soluzioni.
          </p>
        ) : (
          <p className="text-sm text-grafite-2b">
            In raccolta. Si apre con {cfg.problem_support_threshold} sostegni. {supportsText}
          </p>
        )}
        {isActive ? (
          canAct ? (
            <Link href={`/problemi/${id}/proponi`} className="self-start border border-filo px-4 py-2">
              Proponi una soluzione
            </Link>
          ) : (
            <GuestNote state={state} next={`/problemi/${id}`} action="proporre una soluzione" />
          )
        ) : canAct ? (
          <SupportButton problemId={id} supported={supported} />
        ) : (
          <GuestNote state={state} next={`/problemi/${id}`} action="sostenere questo problema" />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Schede</h2>
        {(factsRes.data ?? []).length === 0 ? (
          <p className="text-grafite-2b">Nessuna scheda approvata per ora.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(factsRes.data ?? []).map((f) => (
              <li key={f.id} className="border-b border-filo pb-2">
                <p className="font-serif text-lg">{f.statement}</p>
                {f.source && (
                  <p className="text-sm text-grafite-2b">
                    Fonte ({SOURCE_KIND_LABELS[f.source.kind as keyof typeof SOURCE_KIND_LABELS] ?? f.source.kind}):{" "}
                    <a href={f.source.url} rel="noopener noreferrer nofollow" target="_blank" className="underline">
                      {f.source.title}
                    </a>
                    {f.source.publisher ? `, ${f.source.publisher}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {canAct && (
          <Link href={`/problemi/${id}/scheda`} className="self-start underline">
            Aggiungi un fatto con la sua fonte
          </Link>
        )}
      </section>

      {isActive && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Proposte</h2>
          {proposals.length === 0 ? (
            <p className="text-grafite-2b">Ancora nessuna proposta. Puoi essere la prima persona a scriverne una.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proposals.map((p) => (
                <li key={p.id}>
                  <Link href={`/proposte/${p.id}`} className="font-serif text-lg underline">
                    {p.what}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section id="riformulazioni" className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Si può dire meglio?</h2>
        <p className="text-sm text-grafite-2b">
          Una riformulazione sostituisce il testo se, con almeno {cfg.reformulation_min_votes} voti, è preferita al testo
          attuale.
        </p>
        {reformulations.map((r) => {
          const t = refTallies.get(r.id);
          return (
            <div key={r.id} className="flex flex-col gap-2 border-b border-filo pb-3">
              <p className="font-serif text-lg font-semibold">{r.title}</p>
              <p className="font-serif text-lg whitespace-pre-line">{r.body}</p>
              <p className="text-sm text-grafite-2b">
                {!t || t.below_threshold || t.prefer_new === null
                  ? `Meno di ${cfg.min_votes_item} voti finora.`
                  : `Preferiscono questa versione: ${t.prefer_new}. Il testo attuale: ${t.prefer_current}.`}
              </p>
              {canAct && <ReformulationVote reformulationId={r.id} problemId={id} initial={myRefVotes.get(r.id) ?? null} />}
            </div>
          );
        })}
        {canAct ? (
          <Link href={`/problemi/${id}/riformula`} className="self-start underline">
            Proponi una formulazione più neutra
          </Link>
        ) : (
          <GuestNote state={state} next={`/problemi/${id}`} action="proporre o votare una riformulazione" />
        )}
      </section>

      {(revRes.data ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Versioni precedenti</h2>
          <ul className="flex flex-col gap-2">
            {(revRes.data ?? []).map((v) => (
              <li key={v.id} className="text-grafite-2b">
                <p className="text-sm">Fino al {dateRome.format(new Date(v.replaced_at))}</p>
                <p className="font-serif line-through">{v.title}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
