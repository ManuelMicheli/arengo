import { describe, expect, it } from "vitest";
import { extractExports, extractTables, routeFromFile } from "./ai-map.mjs";

describe("routeFromFile", () => {
  it("mappa page e route ignorando i gruppi", () => {
    expect(routeFromFile("src/app/page.tsx")).toEqual({ path: "/", kind: "page" });
    expect(routeFromFile("src/app/(auth)/login/page.tsx")).toEqual({ path: "/login", kind: "page" });
    expect(routeFromFile("src/app/api/health/route.ts")).toEqual({ path: "/api/health", kind: "route" });
  });

  it("ignora file che non sono rotte", () => {
    expect(routeFromFile("src/app/layout.tsx")).toBeNull();
    expect(routeFromFile("src/app/homepage.tsx")).toBeNull();
    expect(routeFromFile("src/lib/page.ts")).toBeNull();
  });
});

describe("extractExports", () => {
  it("trova dichiarazioni, liste e default", () => {
    const src = [
      "export const a = 1;",
      "export async function b() {}",
      "export type C = string;",
      "export { d, e as f };",
      "export default Home;",
    ].join("\n");
    expect(extractExports(src)).toEqual(["C", "a", "b", "d", "default", "f"]);
  });
});

describe("extractTables", () => {
  it("legge schema e nome", () => {
    const sql = "create table public.profiles (id uuid);\nCREATE TABLE IF NOT EXISTS private.jury_panels ();\ncreate view proposals_public as select 1;";
    expect(extractTables(sql)).toEqual(["public.profiles", "private.jury_panels", "public.proposals_public"]);
  });
});
