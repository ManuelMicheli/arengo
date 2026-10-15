"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rpcErrorMessage } from "@/lib/content/errors";
import { loadResults, type ProposalResults } from "@/lib/content/results";
import { argumentSchema, voteSchema } from "@/lib/content/schemas";
import { writeContent, type WriteState } from "@/lib/content/write";
import { SEED_COOKIE } from "@/lib/seed-order";
import { createUserClient } from "@/lib/supabase/server";

// Voto (RPC per authenticated, pseudo nel DB) e risultati aggregati subito dopo (D2).
export async function voteProposal(proposalId: string, value: number): Promise<{ error?: string; results?: ProposalResults }> {
  const parsed = voteSchema.safeParse({ item_id: proposalId, value });
  if (!parsed.success) return { error: rpcErrorMessage(null) };
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("cast_vote", { item_type: "proposal", item_id: parsed.data.item_id, value: parsed.data.value });
  if (error) return { error: rpcErrorMessage(error) };
  const seed = (await cookies()).get(SEED_COOKIE)?.value ?? "senza-seed";
  return { results: await loadResults(supabase, parsed.data.item_id, seed) };
}

export async function rateArgument(argumentId: string, proposalId: string, useful: boolean): Promise<{ error?: string }> {
  const a = z.uuid().safeParse(argumentId);
  const p = z.uuid().safeParse(proposalId);
  if (!a.success || !p.success) return { error: rpcErrorMessage(null) };
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("rate_argument", { argument_id: a.data, useful });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/proposte/${p.data}`);
  return {};
}

export async function createArgument(_prev: WriteState, form: FormData): Promise<WriteState> {
  const result = await writeContent({
    schema: argumentSchema,
    form,
    contentType: "argument",
    texts: (d) => [d.body],
    rpc: (service, userId, d) =>
      service.rpc("create_argument", { user_id: userId, proposal_id: d.proposal_id, side: d.side, body: d.body }),
  });
  if (result.ok) revalidatePath(`/proposte/${String(form.get("proposal_id"))}`);
  return result;
}
