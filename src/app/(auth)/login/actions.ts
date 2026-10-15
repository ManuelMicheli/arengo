"use server";

import { redirect } from "next/navigation";
import { readConfig } from "@/lib/config";
import { otpCodeSchema, phoneSchema } from "@/lib/phone";
import { allowOtpRequest, otpLimitsSchema } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { createUserClient } from "@/lib/supabase/server";

export type LoginState = {
  step: "phone" | "code";
  phone?: string;
  error?: string;
  /** 429 quando il limite di richieste è superato (le Server Action non hanno uno status HTTP proprio). */
  status?: 200 | 400 | 429 | 500;
};

const TOO_MANY = "Troppe richieste di codice. Riprova tra qualche minuto.";

export async function sendOtp(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = phoneSchema.safeParse(form.get("phone"));
  if (!parsed.success) return { step: "phone", error: parsed.error.issues[0]?.message, status: 400 };
  const phone = parsed.data;

  const supabase = await createUserClient();
  const limits = otpLimitsSchema.safeParse(await readConfig(supabase, "otp_rate_limits"));
  if (!limits.success) return { step: "phone", error: "Servizio non disponibile.", status: 500 };
  if (!(await allowOtpRequest({ ip: await clientIp(), phone }, limits.data))) {
    return { step: "phone", error: TOO_MANY, status: 429 };
  }

  const captchaToken = form.get("cf-turnstile-response");
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true, captchaToken: typeof captchaToken === "string" ? captchaToken : undefined },
  });
  if (error) {
    if (error.status === 429) return { step: "phone", error: TOO_MANY, status: 429 };
    return { step: "phone", error: "Invio del codice non riuscito. Riprova.", status: 400 };
  }
  return { step: "code", phone, status: 200 };
}

export async function verifyOtp(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = phoneSchema.safeParse(form.get("phone"));
  if (!phone.success) return { step: "phone", error: "Numero non valido.", status: 400 };
  const code = otpCodeSchema.safeParse(form.get("code"));
  if (!code.success) return { step: "code", phone: phone.data, error: code.error.issues[0]?.message, status: 400 };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.verifyOtp({ phone: phone.data, token: code.data, type: "sms" });
  if (error) return { step: "code", phone: phone.data, error: "Codice errato o scaduto.", status: 400 };

  const { data: status } = await supabase.rpc("my_onboarding_status");
  redirect(status === "complete" ? "/" : "/onboarding");
}
