import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/content/viewer";
import { setFollow } from "./actions";

export const metadata: Metadata = { title: "Temi · Arengo" };

export default async function TemiPage({ searchParams }: { searchParams: Promise<{ benvenuto?: string }> }) {
  const { benvenuto } = await searchParams;
  const { supabase, user, state } = await getViewer();
  const { data: topics } = await supabase
    .from("topics")
    .select("id, slug, title, description")
    .eq("is_active", true)
    .order("sort")
    .order("title");
  const followed = new Set<string>();
  if (user && state === "complete") {
    const { data } = await supabase.from("topic_follows").select("topic_id");
    for (const row of data ?? []) followed.add(row.topic_id);
  }
  const welcome = benvenuto === "1" && state === "complete";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{welcome ? "Scegli i temi che ti interessano" : "Temi"}</h1>
      {welcome && (
        <p>Il mazzo del giorno ti proporrà soprattutto questi. Lo sai solo tu, e non entra nel calcolo.</p>
      )}
      {!topics?.length ? (
        <p>Non ci sono ancora temi aperti.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {topics.map((t) => {
            const isFollowed = followed.has(t.id);
            return (
              <li key={t.id} className="flex items-start justify-between gap-4 border-b border-filo pb-3">
                <div>
                  <Link href={`/temi/${t.slug}`} className="font-semibold underline">
                    {t.title}
                  </Link>
                  {t.description && <p className="text-grafite-2b">{t.description}</p>}
                </div>
                {state === "complete" && (
                  <form action={setFollow}>
                    <input type="hidden" name="topic_id" value={t.id} />
                    <input type="hidden" name="follow" value={isFollowed ? "0" : "1"} />
                    <button type="submit" aria-pressed={isFollowed} className="min-h-11 border border-filo px-3 py-2">
                      {isFollowed ? "Segui già" : "Segui"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {welcome && (
        <nav className="flex gap-4">
          <Link href="/" className="border border-filo px-4 py-2">
            Continua
          </Link>
          <Link href="/" className="underline">
            Salta
          </Link>
        </nav>
      )}
    </main>
  );
}
