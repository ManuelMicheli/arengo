// Problema per le pagine di scrittura: esiste, non è rimosso. Il resto lo controlla l'RPC.
import { notFound } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/content/viewer";

export async function loadProblemForWriting(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const viewer = await getViewer();
  const { data: problem } = await viewer.supabase
    .from("problems_public")
    .select("id, title, body, status")
    .eq("id", id)
    .maybeSingle();
  if (!problem?.id || !problem.title || !["pending", "active"].includes(problem.status ?? "")) notFound();
  return { ...viewer, problem: { id: problem.id, title: problem.title, body: problem.body ?? "", status: problem.status! } };
}
