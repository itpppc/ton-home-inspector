import { describe, expect, it } from "vitest";
import { isEmailOtpType, safeNext } from "@/lib/auth/redirect";

describe("safeNext", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/inspect?x=1")).toBe("/inspect?x=1");
    expect(safeNext("/reset-password")).toBe("/reset-password");
  });
  it("rejects open redirects and empty values", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined]) expect(safeNext(bad)).toBe("/");
    expect(safeNext("//evil.com", "/reset-password")).toBe("/reset-password");
  });
});

describe("isEmailOtpType", () => {
  it("accepts Supabase email link types only", () => {
    expect(isEmailOtpType("email")).toBe(true);
    expect(isEmailOtpType("recovery")).toBe(true);
    expect(isEmailOtpType("sms")).toBe(false);
    expect(isEmailOtpType(null)).toBe(false);
  });
});
