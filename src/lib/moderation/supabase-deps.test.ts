import { beforeEach, describe, expect, it, vi } from "vitest";
import { createModerationDeps, resetLexiconCache } from "./supabase-deps";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function fakeClients(opts: { rpc?: Rpc; lexicon?: unknown[]; lexiconError?: boolean } = {}) {
  const select = vi.fn(async () =>
    opts.lexiconError ? { data: null, error: { message: "x" } } : { data: opts.lexicon ?? [], error: null },
  );
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(opts.rpc ?? (async () => ({ data: null, error: null })));
  // I client reali sono SupabaseClient<Database>: qui bastano i metodi usati.
  const user = { rpc } as never;
  const service = { from } as never;
  return { user, service, rpc, from, select };
}

beforeEach(() => resetLexiconCache());

describe("createModerationDeps", () => {
  it("registra il blocco con solo livello e tipo", async () => {
    const c = fakeClients({ rpc: async () => ({ data: "2026-10-13T10:30:00Z", error: null }) });
    const until = await createModerationDeps(c.user, c.service).recordBlock(3, "piazza");
    expect(c.rpc).toHaveBeenCalledWith("record_filter_block", { level: 3, content_type: "piazza" });
    expect(until?.toISOString()).toBe("2026-10-13T10:30:00.000Z");
  });

  it("legge il lessico col client service role e lo mette in cache", async () => {
    const c = fakeClients({ lexicon: [{ term: "parolaccia1", level: 2, is_pattern: false }] });
    const deps = createModerationDeps(c.user, c.service);
    await expect(deps.loadLexicon()).resolves.toEqual([{ term: "parolaccia1", level: 2, isPattern: false }]);
    await deps.loadLexicon();
    expect(c.from).toHaveBeenCalledTimes(1);
    expect(c.from).toHaveBeenCalledWith("lexicon_terms");
  });

  it("errori senza dettagli", async () => {
    const c = fakeClients({ rpc: async () => ({ data: null, error: { message: "boom" } }), lexiconError: true });
    const deps = createModerationDeps(c.user, c.service);
    await expect(deps.writingPausedUntil()).rejects.toThrow("moderation_rpc_failed");
    await expect(deps.loadLexicon()).rejects.toThrow("moderation_lexicon_failed");
  });
});
