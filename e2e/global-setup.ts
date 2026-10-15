// Dati di partenza per gli e2e di M4, scritti con il service role dello stack Supabase locale della CI.
// Solo CI: le variabili arrivano da `supabase status` nel job `e2e`.
import { createClient } from "@supabase/supabase-js";

export const E2E = {
  topicSlug: "casa-e2e",
  topicId: "e2e00000-0000-4000-8000-000000000001",
  problemId: "e2e00000-0000-4000-8000-000000000011",
  proposalA: "e2e00000-0000-4000-8000-000000000021",
  proposalB: "e2e00000-0000-4000-8000-000000000022",
} as const;

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("e2e: servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (job CI e2e)");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const steps = [
    db.from("topics").upsert({ id: E2E.topicId, slug: E2E.topicSlug, title: "Casa (e2e)", selection_criterion: "test e2e" }),
    db.from("problems").upsert({
      id: E2E.problemId,
      topic_id: E2E.topicId,
      title: "Affitti delle case troppo alti per chi studia",
      body: "Il costo di una stanza assorbe gran parte del budget di uno studente fuori sede.",
      affected: "Studenti fuori sede",
      status: "active",
      activated_at: new Date().toISOString(),
    }),
    db.from("proposals").upsert([
      { id: E2E.proposalA, problem_id: E2E.problemId, what: "Residenze universitarie pubbliche", how: "h", cost_and_funding: "c", risks: "r" },
      { id: E2E.proposalB, problem_id: E2E.problemId, what: "Bonus affitto per studenti", how: "h", cost_and_funding: "c", risks: "r" },
    ]),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw new Error(`e2e setup: ${error.message}`);
  }
}
