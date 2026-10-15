// Export dei propri dati (art. 20 GDPR) come file JSON. I voti arrivano dal DB via pseudo dell'utente corrente.
import { createUserClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return new Response("Export non disponibile.", { status: error.message.includes("not_authenticated") ? 401 : 400 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arengo-dati.json"',
      "Cache-Control": "no-store",
    },
  });
}
