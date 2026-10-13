import { beforeEach, describe, expect, it, vi } from "vitest";
import { createModerationDeps, resetModerationCache } from "./supabase-deps";

type Result = { data: unknown; error: unknown };
const USER_ID = "11111111-1111-1111-1111-111111111111";

function fakeClients(opts: { rpcResult?: Result; lexicon?: Result; config?: Result } = {}) {
  const ok = (data: unknown): Result => ({ data, error: null });
  const tables: Record<string, Result> = {
    lexicon_terms: opts.lexicon ?? ok([]),
    platform_config:
      opts.config ??
      ok([
        { key: "filter_target_window_words", value: 4 },
        { key: "filter_letter_join_min_run", value: 3 },
      ]),
  };
  const from = vi.fn((table: string) => {
    const result = tables[table]!;
    const query = { in: vi.fn(async () => result), then: (r: (v: Result) => unknown) => Promise.resolve(result).then(r) };
    return { select: vi.fn(() => query) };
  });
  const userRpc = vi.fn(async () => opts.rpcResult ?? ok(null));
  const serviceRpc = vi.fn(async () => opts.rpcResult ?? ok(null));
  // I client reali sono SupabaseClient<Database>: qui bastano i metodi usati.
  const userClient = { rpc: userRpc } as never;
  const serviceClient = { rpc: serviceRpc, from } as never;
  return { userClient, serviceClient, userRpc, serviceRpc, from };
}

beforeEach(() => resetModerationCache());

describe("createModerationDeps", () => {
  it("registra il blocco col service role, con l'utente verificato, livello e tipo", async () => {
    const c = fakeClients({ rpcResult: { data: "2026-10-13T10:30:00Z", error: null } });
    const deps = createModerationDeps({ userClient: c.userClient, serviceClient: c.serviceClient, userId: USER_ID });
    const until = await deps.recordBlock(3, "piazza");
    expect(c.serviceRpc).toHaveBeenCalledWith("record_filter_block", { user_id: USER_ID, level: 3, content_type: "piazza" });
    expect(c.userRpc).not.toHaveBeenCalled();
    expect(until?.toISOString()).toBe("2026-10-13T10:30:00.000Z");
  });

  it("la pausa si legge col client dell'utente", async () => {
    const c = fakeClients();
    const deps = createModerationDeps({ userClient: c.userClient, serviceClient: c.serviceClient, userId: USER_ID });
    await expect(deps.writingPausedUntil()).resolves.toBeNull();
    expect(c.userRpc).toHaveBeenCalledWith("my_writing_pause");
  });

  it("lessico col service role, in cache", async () => {
    const c = fakeClients({ lexicon: { data: [{ term: "parolaccia1", level: 2 }], error: null } });
    const deps = createModerationDeps({ userClient: c.userClient, serviceClient: c.serviceClient, userId: USER_ID });
    await expect(deps.loadLexicon()).resolves.toEqual([{ term: "parolaccia1", level: 2 }]);
    await deps.loadLexicon();
    expect(c.from).toHaveBeenCalledTimes(1);
    expect(c.from).toHaveBeenCalledWith("lexicon_terms");
  });

  it("parametri del filtro da platform_config", async () => {
    const c = fakeClients();
    const deps = createModerationDeps({ userClient: c.userClient, serviceClient: c.serviceClient, userId: USER_ID });
    await expect(deps.loadFilterParams()).resolves.toEqual({ targetWindowWords: 4, letterJoinMinRun: 3 });
  });

  it("config mancante o errori: messaggi senza dettagli", async () => {
    const c = fakeClients({
      rpcResult: { data: null, error: { message: "boom" } },
      lexicon: { data: null, error: { message: "x" } },
      config: { data: [], error: null },
    });
    const deps = createModerationDeps({ userClient: c.userClient, serviceClient: c.serviceClient, userId: USER_ID });
    await expect(deps.writingPausedUntil()).rejects.toThrow("moderation_rpc_failed");
    await expect(deps.loadLexicon()).rejects.toThrow("moderation_lexicon_failed");
    await expect(deps.loadFilterParams()).rejects.toThrow("moderation_config_missing");
  });
});
