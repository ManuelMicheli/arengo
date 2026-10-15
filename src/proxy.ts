// Solo UX: rinfresca la sessione Supabase, assegna il seed di sessione per l'ordine casuale (M4) e manda
// all'onboarding chi non l'ha completato.
// Non è un confine di sicurezza: il blocco vero sta nelle RPC/RLS (assert_can_vote / assert_can_write).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { SEED_COOKIE } from "@/lib/seed-cookie";

const OPEN_PATHS = ["/login", "/onboarding", "/account"];

export async function proxy(request: NextRequest) {
  // Seed casuale di sessione (cookie di sessione, httpOnly): ordina proposte e argomenti in modo diverso per
  // ogni persona ma stabile durante la visita. Non identifica nessuno e non va nel DB.
  const newSeed = request.cookies.has(SEED_COOKIE) ? null : crypto.randomUUID();
  if (newSeed) request.cookies.set(SEED_COOKIE, newSeed);
  const withSeed = (_req: NextRequest, res: NextResponse): NextResponse => {
    if (newSeed) {
      res.cookies.set(SEED_COOKIE, newSeed, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
      });
    }
    return res;
  };
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return withSeed(request, response);

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return withSeed(request, response);

  const path = request.nextUrl.pathname;
  if (OPEN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return withSeed(request, response);

  const { data: status } = await supabase.rpc("my_onboarding_status");
  if (status === "incomplete") {
    const redirect = NextResponse.redirect(new URL("/onboarding", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return withSeed(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"],
};
