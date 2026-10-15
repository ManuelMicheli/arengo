// Risultati dopo il voto (D2): solo aggregati sopra min_votes_item e un argomento per lato.
// Prima della run (cross_utility null) l'argomento è il primo nell'ordine casuale dell'utente, non "il migliore".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { seededOrder } from "@/lib/seed-order";

export type Argument = { id: string; side: "pro" | "contro"; body: string; cross_utility: number | null };

export type ProposalResults = {
  belowThreshold: boolean;
  agree: number | null;
  disagree: number | null;
  pass: number | null;
  total: number | null;
  minVotes: number;
  topPro: Argument | null;
  topContro: Argument | null;
  ranked: boolean;
};

export function orderArguments(args: readonly Argument[], seed: string): Argument[] {
  const ranked = args.filter((a) => a.cross_utility !== null).sort((a, b) => (b.cross_utility ?? 0) - (a.cross_utility ?? 0));
  const unranked = seededOrder(
    args.filter((a) => a.cross_utility === null),
    seed,
  );
  return [...ranked, ...unranked];
}

export async function loadArguments(client: SupabaseClient<Database>, proposalId: string, seed: string): Promise<Argument[]> {
  const { data } = await client
    .from("arguments_public")
    .select("id, side, body, cross_utility, status")
    .eq("proposal_id", proposalId)
    .neq("status", "removed");
  const args = (data ?? [])
    .filter((a) => a.id && a.body && (a.side === "pro" || a.side === "contro"))
    .map((a) => ({ id: a.id!, side: a.side as "pro" | "contro", body: a.body!, cross_utility: a.cross_utility }));
  return orderArguments(args, seed);
}

export async function loadResults(client: SupabaseClient<Database>, proposalId: string, seed: string): Promise<ProposalResults> {
  const [{ data: tally }, { data: cfg }, args] = await Promise.all([
    client.from("proposal_tallies").select("agree, disagree, pass, total, below_threshold").eq("proposal_id", proposalId).maybeSingle(),
    client.from("platform_config").select("value").eq("key", "min_votes_item").maybeSingle(),
    loadArguments(client, proposalId, seed),
  ]);
  if (typeof cfg?.value !== "number") throw new Error("config_missing");
  const below = !tally || tally.below_threshold !== false;
  return {
    belowThreshold: below,
    agree: below ? null : tally!.agree,
    disagree: below ? null : tally!.disagree,
    pass: below ? null : tally!.pass,
    total: below ? null : tally!.total,
    minVotes: cfg.value,
    topPro: args.find((a) => a.side === "pro") ?? null,
    topContro: args.find((a) => a.side === "contro") ?? null,
    ranked: args.some((a) => a.cross_utility !== null),
  };
}
