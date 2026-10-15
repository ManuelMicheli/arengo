// Solo UX: rinfresca la sessione Supabase e manda all'onboarding chi non l'ha completato.
// Non è un confine di sicurezza: il blocco vero sta nelle RPC/RLS (assert_can_vote / assert_can_write).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const OPEN_PATHS = ["/login", "/onboarding", "/account"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

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
  if (!user) return response;

  const path = request.nextUrl.pathname;
  if (OPEN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return response;

  const { data: status } = await supabase.rpc("my_onboarding_status");
  if (status === "incomplete") {
    const redirect = NextResponse.redirect(new URL("/onboarding", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"],
};
