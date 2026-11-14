import { describe, expect, it } from "vitest";
import { suggestSeverity } from "@/lib/domain/severity";

describe("suggestSeverity (rule-based, never lowers the checklist priority)", () => {
  it("falls back to the item priority", () => {
    expect(suggestSeverity({ text: "สีลอกเล็กน้อย", priority: "MEDIUM" }).severity).toBe("MEDIUM");
    expect(suggestSeverity({ text: "" }).severity).toBe("LOW");
  });
  it("raises severity on leak keywords", () => {
    const s = suggestSeverity({ text: "ท่อรั่วซึมใต้อ่าง", priority: "LOW" });
    expect(s.severity).toBe("HIGH");
    expect(s.reasons.join()).toContain("รั่ว");
  });
  it("marks electrical/structural findings critical and requiring an engineer", () => {
    expect(suggestSeverity({ text: "พบรอยร้าวเฉียงที่คาน", priority: "LOW" })).toMatchObject({ severity: "CRITICAL", requiresEngineer: true });
    expect(suggestSeverity({ text: "ไม่มีสายดินที่เต้ารับ" }).severity).toBe("CRITICAL");
  });
  it("never lowers a higher priority", () => {
    expect(suggestSeverity({ text: "บิ่นเล็กน้อย", priority: "CRITICAL" }).severity).toBe("CRITICAL");
  });
  it("engineering-scope items always suggest an engineer", () => {
    expect(suggestSeverity({ text: "ตรวจแล้วไม่ผ่าน", scope: "ENGINEERING" }).requiresEngineer).toBe(true);
    expect(suggestSeverity({ text: "ประตูฝืด", scope: "GENERAL" }).requiresEngineer).toBe(false);
  });
});
