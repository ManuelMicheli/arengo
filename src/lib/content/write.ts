// Scrittura di un contenuto testuale da Server Action: sessione verificata → Zod → filtro (guardContent)
// → RPC riservata al service role con l'utente della sessione. I limiti giornalieri e i controlli di
// stato/onboarding/pausa li applica il DB. Il testo bloccato non si salva, non si logga e non torna al client.
import type { z } from "zod";
import type { ContentType } from "@/lib/moderation/guard";
import { guardContent } from "@/lib/moderation/guard";
import { createModerationDeps } from "@/lib/moderation/supabase-deps";
import { createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rpcErrorMessage } from "./errors";

export type WriteState = { ok?: boolean; error?: string; id?: string };

type Service = ReturnType<typeof createServiceClient>;

export async function writeContent<S extends z.ZodType>(opts: {
  schema: S;
  form: FormData;
  contentType: ContentType;
  /** Testi da passare al filtro (tutti i campi liberi, uniti). */
  texts: (data: z.infer<S>) => string[];
  rpc: (service: Service, userId: string, data: z.infer<S>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}): Promise<WriteState> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: rpcErrorMessage({ message: "not_authenticated" }) };

  const parsed = opts.schema.safeParse(Object.fromEntries(opts.form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Controlla i campi e riprova." };

  const service = createServiceClient();
  const guard = await guardContent(
    opts.texts(parsed.data).filter(Boolean).join("\n\n"),
    opts.contentType,
    createModerationDeps({ userClient: supabase, serviceClient: service, userId: user.id }),
  );
  if (!guard.ok) return { error: guard.message };

  const { data, error } = await opts.rpc(service, user.id, parsed.data);
  if (error) return { error: rpcErrorMessage(error) };
  return { ok: true, id: typeof data === "string" ? data : undefined };
}
