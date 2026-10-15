"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rpcErrorMessage } from "@/lib/content/errors";
import { factSchema, proposalSchema, reformulationSchema } from "@/lib/content/schemas";
import { writeContent, type WriteState } from "@/lib/content/write";
import { createUserClient } from "@/lib/supabase/server";

const id = z.uuid();

// Sostegno e voto sulle riformulazioni: RPC per authenticated (pseudo calcolato nel DB).
export async function supportProblem(problemId: string): Promise<{ error?: string }> {
  const parsed = id.safeParse(problemId);
  if (!parsed.success) return { error: rpcErrorMessage(null) };
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("support_problem", { problem_id: parsed.data });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/problemi/${parsed.data}`);
  return {};
}

export async function voteReformulation(reformulationId: string, problemId: string, value: 1 | -1): Promise<{ error?: string }> {
  const r = id.safeParse(reformulationId);
  const p = id.safeParse(problemId);
  if (!r.success || !p.success || (value !== 1 && value !== -1)) return { error: rpcErrorMessage(null) };
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("cast_vote", { item_type: "reformulation", item_id: r.data, value });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/problemi/${p.data}`);
  return {};
}

export async function proposeReformulation(_prev: WriteState, form: FormData): Promise<WriteState> {
  const result = await writeContent({
    schema: reformulationSchema,
    form,
    contentType: "reformulation",
    texts: (d) => [d.title, d.body],
    rpc: (service, userId, d) =>
      service.rpc("propose_reformulation", { user_id: userId, problem_id: d.problem_id, title: d.title, body: d.body }),
  });
  if (result.ok) redirect(`/problemi/${String(form.get("problem_id"))}#riformulazioni`);
  return result;
}

export async function proposeFact(_prev: WriteState, form: FormData): Promise<WriteState> {
  return writeContent({
    schema: factSchema,
    form,
    contentType: "fact",
    texts: (d) => [d.statement, d.source_title, d.source_publisher ?? ""],
    rpc: (service, userId, d) =>
      service.rpc("propose_fact", {
        user_id: userId,
        problem_id: d.problem_id,
        statement: d.statement,
        source_url: d.source_url,
        source_title: d.source_title,
        source_publisher: d.source_publisher ?? "",
        source_kind: d.source_kind,
      }),
  });
}

export async function createProposal(_prev: WriteState, form: FormData): Promise<WriteState> {
  const result = await writeContent({
    schema: proposalSchema,
    form,
    contentType: "proposal",
    texts: (d) => [d.what, d.how, d.cost_and_funding, d.risks, d.foreign_example ?? "", d.foreign_source_title ?? ""],
    rpc: (service, userId, d) =>
      service.rpc("create_proposal", {
        user_id: userId,
        problem_id: d.problem_id,
        what: d.what,
        how: d.how,
        cost_and_funding: d.cost_and_funding,
        risks: d.risks,
        foreign_example: d.foreign_example ?? "",
        foreign_source_url: d.foreign_source_url ?? "",
        foreign_source_title: d.foreign_source_title ?? "",
        foreign_source_kind: d.foreign_source_kind ?? "",
      }),
  });
  if (result.ok && result.id) redirect(`/proposte/${result.id}?nuova=1`);
  return result;
}
