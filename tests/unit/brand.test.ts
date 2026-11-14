import { describe, expect, it } from "vitest";
import { TON_AI, tonAiCopyright } from "@/lib/brand/ton-ai";

describe("TON AI developer credit", () => {
  it("uses Buddhist Era and links to the official site", () => {
    expect(tonAiCopyright(new Date("2026-11-15"))).toBe("© 2569 TON AI SERVICE TECH · สงวนลิขสิทธิ์");
    expect(tonAiCopyright(new Date("2027-03-01"))).toBe("© 2569–2570 TON AI SERVICE TECH · สงวนลิขสิทธิ์");
    expect(TON_AI.url).toBe("https://ton-ai-tech.web.app/");
  });
});
