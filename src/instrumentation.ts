// All'avvio del server Node: in produzione rifiuta di partire con il segreto dei pseudo di test.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertAppSecret } = await import("./lib/secret-guard");
  await assertAppSecret();
}
