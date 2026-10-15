import { describe, expect, it } from "vitest";
import { assertProductionSecret, isProductionEnv } from "../src/guard/secret-guard";

describe("assertProductionSecret", () => {
  it("in produzione con il segreto di test rifiuta di partire", async () => {
    await expect(assertProductionSecret({ ARENGO_ENV: "production" }, async () => true)).rejects.toThrow(
      /valore di test/,
    );
  });

  it("in produzione con un segreto vero parte", async () => {
    await expect(assertProductionSecret({ ARENGO_ENV: "production" }, async () => false)).resolves.toBeUndefined();
  });

  it("in produzione, se la verifica fallisce, rifiuta di partire", async () => {
    await expect(
      assertProductionSecret({ VERCEL_ENV: "production" }, async () => {
        throw new Error("rete");
      }),
    ).rejects.toThrow(/impossibile verificare/);
  });

  it("fuori produzione non interroga il DB", async () => {
    let called = false;
    await assertProductionSecret({ VERCEL_ENV: "preview" }, async () => {
      called = true;
      return true;
    });
    expect(called).toBe(false);
  });

  it("riconosce la produzione da ARENGO_ENV o VERCEL_ENV", () => {
    expect(isProductionEnv({})).toBe(false);
    expect(isProductionEnv({ ARENGO_ENV: "production" })).toBe(true);
    expect(isProductionEnv({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionEnv({ NODE_ENV: "production" })).toBe(false);
  });
});
