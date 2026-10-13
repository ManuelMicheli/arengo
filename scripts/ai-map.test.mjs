import { describe, expect, it } from "vitest";
import { extractExports, extractTables, isEntrypoint, routeFromFile } from "./ai-map.mjs";

describe("isEntrypoint", () => {
  const winUrl = "file:///D:/PROGETTI/ARENGO/scripts/ai-map.mjs";
  it.runIf(process.platform === "win32")("riconosce le varianti di percorso Windows", () => {
    expect(isEntrypoint("D:\\PROGETTI\\ARENGO\\scripts\\ai-map.mjs", winUrl, "win32")).toBe(true);
    expect(isEntrypoint("d:/progetti/arengo/scripts/ai-map.mjs", winUrl, "win32")).toBe(true);
    expect(isEntrypoint("/d/PROGETTI/ARENGO/scripts/ai-map.mjs", winUrl, "win32")).toBe(true);
    expect(isEntrypoint("D:\\PROGETTI\\ARENGO\\scripts\\altro.mjs", winUrl, "win32")).toBe(false);
  });
  it.runIf(process.platform !== "win32")("confronta percorsi POSIX", () => {
    expect(isEntrypoint("/repo/scripts/ai-map.mjs", "file:///repo/scripts/ai-map.mjs", "linux")).toBe(true);
    expect(isEntrypoint("/repo/scripts/altro.mjs", "file:///repo/scripts/ai-map.mjs", "linux")).toBe(false);
  });
  it("senza argv non è entrypoint", () => {
    expect(isEntrypoint(undefined)).toBe(false);
  });
});

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
