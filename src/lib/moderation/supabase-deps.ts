// Collega guardContent a Supabase. Solo lato server (Server Action), dopo aver verificato la sessione:
// - `userId` deve venire da `supabase.auth.getUser()` lato server, mai dal client;
// - pausa con il client dell'utente (RPC my_writing_pause, auth.uid());
// - registrazione dei blocchi, lessico e parametri con il client service role
//   (record_filter_block non è eseguibile da authenticated; il lessico non è leggibile).
// Cache di 60 s per lessico e parametri: costante strutturale (vedi Decisioni in docs/PLAN.md).
// Gli errori non contengono mai il testo controllato.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { FilterParams, LexiconEntry, SeverityLevel } from "./check-content";
import type { ModerationDeps } from "./guard";

type Client = SupabaseClient<Database>;

const CACHE_TTL_MS = 60_000;
const PARAM_KEYS = { filter_target_window_words: "targetWindowWords", filter_letter_join_min_run: "letterJoinMinRun" } as const;

let lexiconCache: { at: number; entries: readonly LexiconEntry[] } | null = null;
let paramsCache: { at: number; params: FilterParams } | null = null;

export function resetModerationCache(): void {
  lexiconCache = null;
  paramsCache = null;
}

const fresh = (c: { at: number } | null): boolean => c !== null && Date.now() - c.at < CACHE_TTL_MS;
const toDate = (value: string | null): Date | null => (value ? new Date(value) : null);

export function createModerationDeps(opts: { userClient: Client; serviceClient: Client; userId: string }): ModerationDeps {
  const { userClient, serviceClient, userId } = opts;
  return {
    async loadLexicon() {
      if (fresh(lexiconCache)) return lexiconCache!.entries;
      const { data, error } = await serviceClient.from("lexicon_terms").select("term, level");
      if (error) throw new Error("moderation_lexicon_failed");
      // Nuovo array = nuova versione: checkContent la compila una volta sola.
      const entries = data.map((r) => ({ term: r.term, level: r.level as SeverityLevel }));
      lexiconCache = { at: Date.now(), entries };
      return entries;
    },
    async loadFilterParams() {
      if (fresh(paramsCache)) return paramsCache!.params;
      const { data, error } = await serviceClient
        .from("platform_config")
        .select("key, value")
        .in("key", Object.keys(PARAM_KEYS));
      if (error) throw new Error("moderation_config_failed");
      const values = new Map(data.map((r) => [r.key, r.value]));
      const read = (key: keyof typeof PARAM_KEYS) => {
        const v = values.get(key);
        if (typeof v !== "number") throw new Error("moderation_config_missing");
        return v;
      };
      const params: FilterParams = {
        targetWindowWords: read("filter_target_window_words"),
        letterJoinMinRun: read("filter_letter_join_min_run"),
      };
      paramsCache = { at: Date.now(), params };
      return params;
    },
    async writingPausedUntil() {
      const { data, error } = await userClient.rpc("my_writing_pause");
      if (error) throw new Error("moderation_rpc_failed");
      return toDate(data);
    },
    async recordBlock(level, contentType) {
      const { data, error } = await serviceClient.rpc("record_filter_block", {
        user_id: userId,
        level,
        content_type: contentType,
      });
      if (error) throw new Error("moderation_rpc_failed");
      return toDate(data);
    },
  };
}
