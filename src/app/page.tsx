import Link from "next/link";
import { getViewer } from "@/lib/content/viewer";
import { Deck, type DeckCard } from "./deck";

// Ospite: presentazione e lettura libera. Utente registrato: il mazzo del giorno (D4).
export default async function Home({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const { supabase, state } = await getViewer();

  let cards: DeckCard[] | null = null;
  if (state === "complete") {
    const { data } = await supabase.rpc("daily_deck");
    cards = (data ?? []).map((c) => ({
      proposal_id: c.proposal_id,
      problem_title: c.problem_title,
      topic_title: c.topic_title,
      what: c.what,
    }));
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Arengo</h1>
        {account === "eliminato" && <p role="status">Il tuo account è stato cancellato.</p>}
        {cards === null && <p>Discutere di politica per trovare soluzioni condivise.</p>}
      </header>

      {cards !== null ? (
        <Deck cards={cards} />
      ) : (
        <section className="flex flex-col gap-2">
          <p>Leggi problemi e proposte senza registrarti. Per votare e scrivere serve un account verificato.</p>
          {state === "incomplete" && (
            <Link href="/onboarding" className="self-start underline">
              Completa la registrazione
            </Link>
          )}
        </section>
      )}

      <nav className="flex flex-wrap gap-4">
        <Link href="/temi" className="underline">
          Temi
        </Link>
        <Link href="/cerca" className="underline">
          Cerca
        </Link>
        {state === "anonymous" ? (
          <Link href="/login" className="underline">
            Accedi
          </Link>
        ) : (
          <Link href="/account" className="underline">
            Account
          </Link>
        )}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </nav>
    </main>
  );
}
