import type { InspectionScope, Priority, Severity } from "./types";

/**
 * Rule-based severity suggestion (transparent and editable — not AI).
 * Base = checklist item priority; keyword rules can only raise it.
 */
const RANK: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const max = (a: Severity, b: Severity) => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b);

const RULES: { level: Severity; reason: string; words: string[] }[] = [
  { level: "CRITICAL", reason: "เกี่ยวกับความปลอดภัยไฟฟ้า/โครงสร้าง", words: ["ไฟดูด", "ไฟรั่ว", "ไม่มีสายดิน", "สายดิน", "rcd", "rcbo", "ช็อต", "ไหม้", "ร้าวเฉียง", "ร้าวทะลุ", "แอ่นตัว", "ทรุด", "เสา", "คาน", "โครงสร้าง", "ราวโยก", "ราวกันตก"] },
  { level: "HIGH", reason: "รั่วซึม/น้ำขัง/ใช้งานหลักไม่ได้", words: ["รั่ว", "ซึม", "น้ำขัง", "ท่อตัน", "อุดตัน", "ล็อกไม่ได้", "ปิดไม่สนิท", "ไม่ทำงาน", "ไฟไม่เข้า", "แรงดันต่ำ", "ชักโครก"] },
  { level: "MEDIUM", reason: "กระทบการใช้งานบางส่วน", words: ["ฝืด", "ครูด", "กลวง", "หลวม", "แตก", "บิ่น", "มุ้งลวด"] },
];

export interface SeveritySuggestion {
  severity: Severity;
  reasons: string[];
  requiresEngineer: boolean;
}

const PRIORITY_TO_SEVERITY: Record<Priority, Severity> = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" };

export function suggestSeverity(input: { text: string; priority?: Priority | null; scope?: InspectionScope | null }): SeveritySuggestion {
  const text = input.text.toLowerCase();
  let severity: Severity = input.priority ? PRIORITY_TO_SEVERITY[input.priority] : "LOW";
  const reasons: string[] = input.priority ? [`ความสำคัญของหัวข้อ: ${input.priority}`] : [];
  for (const rule of RULES) {
    if (rule.words.some((w) => text.includes(w))) {
      if (RANK.indexOf(rule.level) > RANK.indexOf(severity)) reasons.push(rule.reason);
      severity = max(severity, rule.level);
    }
  }
  const structuralWords = ["ร้าวเฉียง", "ร้าวทะลุ", "ทรุด", "เสา", "คาน", "โครงสร้าง", "แอ่นตัว"];
  const requiresEngineer = input.scope === "ENGINEERING" || structuralWords.some((w) => text.includes(w));
  return { severity, reasons, requiresEngineer };
}
