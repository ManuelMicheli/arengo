# src/ — app Next.js

## Stack dell'area
Next.js 16 App Router (Turbopack), React 19, TypeScript strict (`noUncheckedIndexedAccess`), Tailwind 4 (`@import "tailwindcss"` in `app/globals.css`, niente `tailwind.config`). Alias `@/*` → `src/*`.

## Convenzioni
- Client Supabase: `lib/supabase/server.ts` (sessione utente, cookie) e `lib/supabase/service.ts` (service role, solo RPC riservate al server con `user_id` da `auth.getUser()`).
- Rotte e Server Actions in `app/`; logica condivisa in `lib/` (client Supabase, rate limit, `checkContent`, schemi Zod).
- Server Component di default; `"use client"` solo dove serve interazione.
- Intercettazione richieste in `proxy.ts` (non `middleware.ts`): solo UX (redirect), mai confine di sicurezza. L'autorizzazione vera sta in RLS/RPC.
- Scrittura: Server Action → Zod → rate limit (soglia da `platform_config`) → `checkContent` (testi) → RPC/insert. Mai insert diretti su tabelle di voto.
- Mai leggere `author_id` o `voter_pseudo`: usare le viste `*_public` e gli aggregati.
- Testo bloccato dal filtro: non salvarlo, non loggarlo (console, Sentry, errori).
- Font solo self-hosted (`next/font/local`, file in `app/fonts/`, licenza OFL accanto). Mai font da Google (né loader `google` di next/font né CDN).
- UI in italiano, date in Europe/Rome. HTML semantico + Tailwind con i soli token di `app/globals.css` (niente colori, font o grigi di default di Tailwind). Regole visive in `docs/DESIGN.md`; il design delle pagine lo decide Manuel.
- `types/database.ts` è generato: non scriverlo a mano, non leggerlo intero.
- Segreti solo da `process.env` (elenco in `.env.example`); `NEXT_PUBLIC_*` solo per valori pubblici.

## Test
Vitest: file `*.test.ts(x)` accanto al codice, `pnpm test` (alias `@/` attivo). E2E Playwright in `e2e/`: solo job CI `e2e`, mai in locale. `pnpm typecheck` esegue prima `next typegen`.
