import Link from "next/link";
import { readNumbers } from "@/lib/content/config";
import { isWithinDays } from "@/lib/content/dates";
import { getViewer } from "@/lib/content/viewer";
import { Deck, type DeckCard } from "./deck";

// Ospite: presentazione e lettura libera. Utente registrato: il mazzo del giorno (D4).
export default async function Home({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const { supabase, state } = await getViewer();

  let cards: DeckCard[] | null = null;
  let engineAgeDays: number | null = null;
  if (state === "complete") {
    // Account più giovane di min_account_age_days_for_engine: a fine mazzo lo diciamo invece di nasconderlo.
    const [{ data: profile }, cfg] = await Promise.all([
      supabase.from("profiles").select("created_at").maybeSingle(),
      readNumbers(supabase, ["min_account_age_days_for_engine"] as const),
    ]);
    const days = cfg.min_account_age_days_for_engine;
    if (profile && isWithinDays(profile.created_at, days)) engineAgeDays = days;
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
        <Deck cards={cards} engineAgeDays={engineAgeDays} />
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
