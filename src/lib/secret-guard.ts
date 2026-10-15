// Guardia di avvio dell'app (3.5): stessa regola del motore (engine/src/guard/secret-guard.ts).
import { assertProductionSecret } from "../../engine/src/guard/secret-guard";
import { createServiceClient } from "./supabase/service";

export async function assertAppSecret(env: Readonly<Record<string, string | undefined>> = process.env): Promise<void> {
  await assertProductionSecret(env, async () => {
    const { data, error } = await createServiceClient().rpc("pseudo_secret_is_test");
    if (error || typeof data !== "boolean") throw new Error("secret_check_failed");
    return data;
  });
}
