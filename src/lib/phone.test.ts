import { describe, expect, it } from "vitest";
import { otpCodeSchema, phoneSchema } from "./phone";

describe("phoneSchema", () => {
  it("normalizza in E.164", () => {
    expect(phoneSchema.parse("333 123 4567")).toBe("+393331234567");
    expect(phoneSchema.parse("+39 333-123-4567")).toBe("+393331234567");
    expect(phoneSchema.parse("0039 3331234567")).toBe("+393331234567");
  });

  it("rifiuta numeri non italiani o fissi", () => {
    expect(phoneSchema.safeParse("+441234567890").success).toBe(false);
    expect(phoneSchema.safeParse("+39021234567").success).toBe(false);
    expect(phoneSchema.safeParse("abc").success).toBe(false);
  });
});

describe("otpCodeSchema", () => {
  it("accetta solo 6 cifre", () => {
    expect(otpCodeSchema.safeParse("123456").success).toBe(true);
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
  });
});
