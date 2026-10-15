"use server";

// Temi seguiti (D3): visibili solo a chi li segue (RLS), nessun testo, nessun effetto sul calcolo.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";

const topicId = z.uuid();

export async function setFollow(form: FormData): Promise<void> {
  const parsed = topicId.safeParse(form.get("topic_id"));
  if (!parsed.success) return;
  const follow = form.get("follow") === "1";
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (follow) {
    await supabase.from("topic_follows").upsert({ user_id: user.id, topic_id: parsed.data }, { ignoreDuplicates: true });
  } else {
    await supabase.from("topic_follows").delete().eq("user_id", user.id).eq("topic_id", parsed.data);
  }
  revalidatePath("/temi");
}
