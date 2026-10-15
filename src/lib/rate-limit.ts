// Rate limit delle richieste OTP per IP e per numero (soglie da platform_config.otp_rate_limits).
// Su Redis il numero non va mai in chiaro: chiave = HMAC(numero, RATE_LIMIT_KEY_SECRET).
// Senza Upstash si usa un contatore in memoria, ammesso solo in sviluppo o CI (fail-closed altrove).

import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { z } from "zod";

type Env = Readonly<Record<string, string | undefined>>;

/** Sviluppo locale (`next dev`/test) o CI esplicita: gli unici ambienti con fallback non sicuri ammessi. */
export function isNonProductionEnv(env: Env): boolean {
  return env.NODE_ENV !== "production" || env.ARENGO_ENV === "development" || env.ARENGO_ENV === "ci";
}

export const otpLimitsSchema = z.object({
  per_ip: z.number().int().positive(),
  per_phone: z.number().int().positive(),
  window_minutes: z.number().int().positive(),
});
export type OtpLimits = z.infer<typeof otpLimitsSchema>;

export type LimitStore = {
  /** Conta una richiesta per `key`; true se entro `limit` nella finestra. */
  hit: (key: string, limit: number, windowMinutes: number) => Promise<boolean>;
};

export function memoryStore(now: () => number = Date.now): LimitStore {
  const hits = new Map<string, number[]>();
  return {
    async hit(key, limit, windowMinutes) {
      const from = now() - windowMinutes * 60_000;
      const recent = (hits.get(key) ?? []).filter((t) => t > from);
      const ok = recent.length < limit;
      if (ok) recent.push(now());
      hits.set(key, recent);
      return ok;
    },
  };
}

function upstashStore(redis: Redis): LimitStore {
  const limiters = new Map<string, Ratelimit>();
  return {
    async hit(key, limit, windowMinutes) {
      const id = `${limit}/${windowMinutes}`;
      let limiter = limiters.get(id);
      if (!limiter) {
        limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, `${windowMinutes} m`), prefix: "arengo:rl" });
        limiters.set(id, limiter);
      }
      return (await limiter.limit(key)).success;
    },
  };
}

let defaultStore: LimitStore | null = null;

export function getLimitStore(env: Readonly<Record<string, string | undefined>> = process.env): LimitStore {
  if (defaultStore) return defaultStore;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    defaultStore = upstashStore(new Redis({ url, token }));
  } else if (isNonProductionEnv(env)) {
    defaultStore = memoryStore();
  } else {
    throw new Error("rate_limit_store_missing");
  }
  return defaultStore;
}

export function phoneKey(phone: string, env: Readonly<Record<string, string | undefined>> = process.env): string {
  const secret = env.RATE_LIMIT_KEY_SECRET;
  if (!secret && !isNonProductionEnv(env)) throw new Error("rate_limit_secret_missing");
  return createHmac("sha256", secret ?? "solo-sviluppo").update(phone).digest("hex");
}

/** true se la richiesta OTP è consentita. Conta sempre sia l'IP sia il numero. */
export async function allowOtpRequest(
  input: { ip: string; phone: string },
  limits: OtpLimits,
  store: LimitStore = getLimitStore(),
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<boolean> {
  const [ipOk, phoneOk] = await Promise.all([
    store.hit(`otp:ip:${input.ip}`, limits.per_ip, limits.window_minutes),
    store.hit(`otp:phone:${phoneKey(input.phone, env)}`, limits.per_phone, limits.window_minutes),
  ]);
  return ipOk && phoneOk;
}
