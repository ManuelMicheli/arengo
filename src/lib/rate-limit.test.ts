import { describe, expect, it } from "vitest";
import { allowOtpRequest, getLimitStore, memoryStore, phoneKey } from "./rate-limit";

const limits = { per_ip: 3, per_phone: 2, window_minutes: 15 };
const env = { RATE_LIMIT_KEY_SECRET: "test" };

describe("allowOtpRequest", () => {
  it("blocca il numero oltre per_phone", async () => {
    const store = memoryStore();
    const req = { ip: "1.1.1.1", phone: "+393331234567" };
    expect(await allowOtpRequest(req, limits, store, env)).toBe(true);
    expect(await allowOtpRequest(req, limits, store, env)).toBe(true);
    expect(await allowOtpRequest(req, limits, store, env)).toBe(false);
  });

  it("blocca l'IP oltre per_ip anche con numeri diversi", async () => {
    const store = memoryStore();
    const results = [];
    for (const n of ["1", "2", "3", "4"]) {
      results.push(await allowOtpRequest({ ip: "2.2.2.2", phone: `+39333123456${n}` }, limits, store, env));
    }
    expect(results).toEqual([true, true, true, false]);
  });

  it("riapre dopo la finestra", async () => {
    let t = 0;
    const store = memoryStore(() => t);
    const req = { ip: "3.3.3.3", phone: "+393331234567" };
    await allowOtpRequest(req, limits, store, env);
    await allowOtpRequest(req, limits, store, env);
    expect(await allowOtpRequest(req, limits, store, env)).toBe(false);
    t = 15 * 60_000 + 1;
    expect(await allowOtpRequest(req, limits, store, env)).toBe(true);
  });

  it("la chiave del numero non contiene il numero", () => {
    expect(phoneKey("+393331234567", env)).not.toContain("3331234567");
  });

  it("con NODE_ENV=production senza segreto per le chiavi rifiuta (fail-closed anche fuori Vercel)", () => {
    expect(() => phoneKey("+393331234567", { NODE_ENV: "production" })).toThrow("rate_limit_secret_missing");
    expect(() => phoneKey("+393331234567", { NODE_ENV: "production", ARENGO_ENV: "ci" })).not.toThrow();
  });

  it("con NODE_ENV=production senza Upstash rifiuta il contatore in memoria", () => {
    expect(() => getLimitStore({ NODE_ENV: "production" })).toThrow("rate_limit_store_missing");
  });
});
