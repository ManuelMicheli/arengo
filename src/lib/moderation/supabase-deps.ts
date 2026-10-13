// Collega guardContent a Supabase. Solo lato server (Server Action):
// - pausa e registrazione dei blocchi con il client dell'utente (RPC SECURITY DEFINER, auth.uid());
// - lessico con il client service role (anon/authenticated non lo leggono), in cache per un minuto.
// Gli errori non contengono mai il testo controllato.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LexiconEntry, SeverityLevel } from "./check-content";
import type { ModerationDeps } from "./guard";

type Client = SupabaseClient<Database>;

const LEXICON_TTL_MS = 60_000;
let lexiconCache: { at: number; entries: readonly LexiconEntry[] } | null = null;

export function resetLexiconCache(): void {
  lexiconCache = null;
}

const toDate = (value: string | null): Date | null => (value ? new Date(value) : null);

export function createModerationDeps(userClient: Client, serviceClient: Client): ModerationDeps {
  return {
    async loadLexicon() {
      if (lexiconCache && Date.now() - lexiconCache.at < LEXICON_TTL_MS) return lexiconCache.entries;
      const { data, error } = await serviceClient.from("lexicon_terms").select("term, level, is_pattern");
      if (error) throw new Error("moderation_lexicon_failed");
      const entries = data.map((r) => ({ term: r.term, level: r.level as SeverityLevel, isPattern: r.is_pattern }));
      lexiconCache = { at: Date.now(), entries };
      return entries;
    },
    async writingPausedUntil() {
      const { data, error } = await userClient.rpc("my_writing_pause");
      if (error) throw new Error("moderation_rpc_failed");
      return toDate(data);
    },
    async recordBlock(level, contentType) {
      const { data, error } = await userClient.rpc("record_filter_block", { level, content_type: contentType });
      if (error) throw new Error("moderation_rpc_failed");
      return toDate(data);
    },
  };
}
