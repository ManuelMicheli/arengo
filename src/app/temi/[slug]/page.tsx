import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestNote } from "@/components/guest-note";
import { readNumbers } from "@/lib/content/config";
import { getViewer } from "@/lib/content/viewer";

export const metadata: Metadata = { title: "Tema · Arengo" };

export default async function TemaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, state } = await getViewer();
  const { data: topic } = await supabase.from("topics").select("id, slug, title, description").eq("slug", slug).maybeSingle();
  if (!topic) notFound();

  const [{ data: problems }, cfg] = await Promise.all([
    supabase
      .from("problems_public")
      .select("id, title, status, created_at")
      .eq("topic_id", topic.id)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false }),
    readNumbers(supabase, ["problem_support_threshold"] as const),
  ]);
  const active = (problems ?? []).filter((p) => p.status === "active");
  const pending = (problems ?? []).filter((p) => p.status === "pending");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <nav>
        <Link href="/temi" className="underline">
          ‹ Temi
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{topic.title}</h1>
        {topic.description && <p>{topic.description}</p>}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Problemi aperti</h2>
        {active.length === 0 ? (
          <p className="text-grafite-2b">Nessun problema aperto per ora.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((p) => (
              <li key={p.id}>
                <Link href={`/problemi/${p.id}`} className="font-serif text-lg underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">In raccolta</h2>
        <p className="text-sm text-grafite-2b">
          Un problema si apre con {cfg.problem_support_threshold} sostegni; da lì si possono proporre soluzioni.
        </p>
        {pending.length === 0 ? (
          <p className="text-grafite-2b">Nessun problema in raccolta.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((p) => (
              <li key={p.id}>
                <Link href={`/problemi/${p.id}`} className="font-serif text-lg underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {state === "complete" ? (
        <Link href={`/temi/${topic.slug}/nuovo-problema`} className="self-start border border-filo px-4 py-2">
          Segnala un problema
        </Link>
      ) : (
        <GuestNote state={state} next={`/temi/${topic.slug}`} action="segnalare un problema" />
      )}
    </main>
  );
}
