"use server";

// Temi seguiti (D3): visibili solo a chi li segue, nessun testo, nessun effetto sul calcolo.
// Scrittura via RPC follow_topic (verifica onboarding e stato dell'account nel DB).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";

const topicId = z.uuid();

export async function setFollow(form: FormData): Promise<void> {
  const parsed = topicId.safeParse(form.get("topic_id"));
  if (!parsed.success) return;
  const supabase = await createUserClient();
  await supabase.rpc("follow_topic", { topic_id: parsed.data, follow: form.get("follow") === "1" });
  revalidatePath("/temi");
}
