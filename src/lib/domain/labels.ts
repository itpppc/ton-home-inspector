import type { ConstructionStatus, DefectStatus, InspectionScope, ItemStatus, PhotoKind, Priority, Role, Severity } from "./types";

type Tone = "neutral" | "success" | "danger" | "warning" | "info" | "accent" | "primary";

export const ITEM_STATUS_META: Record<ItemStatus, { label: string; short: string; tone: Tone }> = {
  NOT_CHECKED: { label: "ยังไม่ตรวจ", short: "รอตรวจ", tone: "neutral" },
  PASS: { label: "ผ่าน", short: "ผ่าน", tone: "success" },
  FAIL: { label: "ไม่ผ่าน", short: "ไม่ผ่าน", tone: "danger" },
  NEEDS_REINSPECTION: { label: "ต้องตรวจซ้ำ", short: "ตรวจซ้ำ", tone: "warning" },
  NOT_APPLICABLE: { label: "ไม่เกี่ยวข้อง (N/A)", short: "N/A", tone: "info" },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  LOW: { label: "ต่ำ", tone: "neutral" },
  MEDIUM: { label: "ปานกลาง", tone: "info" },
  HIGH: { label: "สูง", tone: "warning" },
  CRITICAL: { label: "วิกฤต", tone: "danger" },
};

export const SEVERITY_META: Record<Severity, { label: string; hint: string; tone: Tone; color: string }> = {
  LOW: { label: "เล็กน้อย", hint: "งานเก็บความสวยงาม ไม่กระทบการใช้งาน", tone: "neutral", color: "#64748b" },
  MEDIUM: { label: "ปานกลาง", hint: "กระทบการใช้งานบางส่วน ควรแก้ก่อนเข้าอยู่", tone: "info", color: "#0891b2" },
  HIGH: { label: "สูง", hint: "กระทบการใช้งานหลัก/รั่วซึม ต้องแก้ก่อนโอน", tone: "warning", color: "#d97706" },
  CRITICAL: { label: "วิกฤต", hint: "ความปลอดภัย/โครงสร้าง/ไฟฟ้า ห้ามรับโอนจนกว่าจะแก้", tone: "danger", color: "#dc2626" },
};

export const DEFECT_STATUS_META: Record<DefectStatus, { label: string; tone: Tone; color: string }> = {
  OPEN: { label: "พบปัญหา", tone: "danger", color: "#dc2626" },
  SUBMITTED: { label: "แจ้งโครงการแล้ว", tone: "accent", color: "#7c3aed" },
  IN_PROGRESS: { label: "กำลังแก้ไข", tone: "warning", color: "#d97706" },
  FIXED: { label: "แก้แล้ว รอตรวจซ้ำ", tone: "info", color: "#0891b2" },
  VERIFIED: { label: "ตรวจซ้ำผ่าน (ปิดงาน)", tone: "success", color: "#16a34a" },
  REOPENED: { label: "ตรวจซ้ำไม่ผ่าน", tone: "danger", color: "#be123c" },
};

/** Allowed workflow transitions; keeps the defect lifecycle auditable. */
export const DEFECT_TRANSITIONS: Record<DefectStatus, DefectStatus[]> = {
  OPEN: ["SUBMITTED", "IN_PROGRESS", "FIXED"],
  SUBMITTED: ["IN_PROGRESS", "FIXED", "OPEN"],
  IN_PROGRESS: ["FIXED", "SUBMITTED"],
  FIXED: ["VERIFIED", "REOPENED"],
  REOPENED: ["SUBMITTED", "IN_PROGRESS", "FIXED"],
  VERIFIED: ["REOPENED"],
};

export const SCOPE_META: Record<InspectionScope, { label: string; short: string; hint: string; tone: Tone }> = {
  GENERAL: { label: "ตรวจทั่วไป", short: "ทั่วไป", hint: "ตรวจด้วยสายตา/เครื่องมือพื้นฐาน", tone: "neutral" },
  ENGINEERING: { label: "ตรวจทางวิศวกรรม (คัดกรอง)", short: "วิศวกรรม", hint: "คัดกรองเบื้องต้นเท่านั้น ต้องให้วิศวกรผู้มีใบอนุญาตยืนยัน", tone: "accent" },
};

/** Shown wherever engineering findings appear (UI, reports). The app never certifies structural safety. */
export const ENGINEERING_DISCLAIMER =
  "ผลการตรวจหมวดวิศวกรรมในระบบนี้เป็นการคัดกรองและบันทึกหลักฐานเบื้องต้นเท่านั้น ไม่ใช่การรับรองความปลอดภัยของโครงสร้างหรือระบบไฟฟ้า กรุณาให้วิศวกรผู้มีใบอนุญาตประกอบวิชาชีพตรวจสอบและยืนยันก่อนตัดสินใจ";

export const PHOTO_KIND_META: Record<PhotoKind, { label: string }> = {
  DEFECT: { label: "ก่อนแก้ไข" },
  AFTER_FIX: { label: "หลังแก้ไข" },
  ITEM: { label: "ภาพประกอบการตรวจ" },
  PROPERTY: { label: "รูปบ้าน / ผังบ้าน" },
  PROJECT: { label: "รูปโครงการ" },
};

export const CONSTRUCTION_STATUS_META: Record<ConstructionStatus, string> = {
  UNDER_CONSTRUCTION: "อยู่ระหว่างก่อสร้าง",
  READY_FOR_INSPECTION: "พร้อมให้ตรวจ",
  INSPECTING: "กำลังตรวจรับ",
  DEFECT_FIXING: "โครงการกำลังแก้ไข",
  READY_TO_TRANSFER: "พร้อมโอน",
  TRANSFERRED: "โอนกรรมสิทธิ์แล้ว",
};

export const ROLE_META: Record<Role, { label: string; hint: string }> = {
  ADMIN: { label: "Admin", hint: "จัดการทุกอย่าง รวมถึงสมาชิกและการลบ" },
  INSPECTOR: { label: "Inspector", hint: "ตรวจบ้าน บันทึกผล ถ่ายรูป และจัดการ Defect" },
  VIEWER: { label: "Viewer", hint: "ดูข้อมูลและรายงานได้อย่างเดียว" },
};

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/12 text-success border-success/30",
  danger: "bg-danger/12 text-danger border-danger/30",
  warning: "bg-warning/15 text-warning-strong border-warning/40",
  info: "bg-secondary/12 text-secondary-strong border-secondary/30",
  accent: "bg-accent/12 text-accent border-accent/30",
  primary: "bg-primary/10 text-primary border-primary/25",
};
export type { Tone };
