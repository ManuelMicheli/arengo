"use client";

// Widget Cloudflare Turnstile senza dipendenze: aggiunge al form il campo `cf-turnstile-response`,
// che Supabase Auth verifica se il CAPTCHA è attivo nel progetto. Senza site key (CI) non si mostra.
import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

export function Turnstile({ resetKey }: { resetKey: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    // Il token vale una volta sola: dopo ogni invio serve un nuovo controllo.
    window.turnstile?.reset();
  }, [resetKey]);
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-language="it" />
    </>
  );
}
