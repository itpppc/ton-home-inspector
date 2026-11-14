import { z } from "zod";
import { isValidIsoDate } from "./deadline";
import { CONSTRUCTION_STATUSES, INSPECTION_SCOPES, PRIORITIES, SEVERITIES } from "./types";

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `ไม่เกิน ${max} ตัวอักษร`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidIsoDate(v), "วันที่ไม่ถูกต้อง")
  .transform((v) => (v === "" ? null : v))
  .nullable();

/** Accepts "" / number-like strings from inputs, yields number | null. */
const optionalNumber = (opts: { min?: number; max?: number; int?: boolean } = {}) =>
  z
    .union([z.string(), z.number()])
    .nullable()
    .transform((v, ctx) => {
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: "ต้องเป็นตัวเลข" });
        return z.NEVER;
      }
      if (opts.int && !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: "ต้องเป็นจำนวนเต็ม" });
        return z.NEVER;
      }
      if (opts.min !== undefined && n < opts.min) {
        ctx.addIssue({ code: "custom", message: `ต้องไม่น้อยกว่า ${opts.min}` });
        return z.NEVER;
      }
      if (opts.max !== undefined && n > opts.max) {
        ctx.addIssue({ code: "custom", message: `ต้องไม่เกิน ${opts.max}` });
        return z.NEVER;
      }
      return n;
    });

export const projectSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อโครงการ").max(200),
  developer: optionalText(200),
  developer_contact: optionalText(300),
  location: optionalText(500),
  description: optionalText(2000),
  inspection_date: optionalDate,
  reinspection_date: optionalDate,
});
export type ProjectInput = z.input<typeof projectSchema>;
export type ProjectValues = z.output<typeof projectSchema>;

export const propertySchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อบ้าน").max(200),
  plot_number: optionalText(100),
  house_model: optionalText(100),
  property_type: optionalText(100),
  land_area_sqw: optionalNumber({ min: 0, max: 100000 }),
  usable_area_sqm: optionalNumber({ min: 0, max: 100000 }),
  floors: optionalNumber({ min: 1, max: 10, int: true }),
  construction_status: z.enum(CONSTRUCTION_STATUSES),
  inspection_type: optionalText(100),
  inspection_owner: optionalText(100),
  transfer_date_planned: optionalDate,
  transfer_date_actual: optionalDate,
  claim_window_days: optionalNumber({ min: 1, max: 365, int: true }).transform((v) => v ?? 15),
  warranty_info: optionalText(2000),
  price: optionalNumber({ min: 0 }),
  booking_fee: optionalNumber({ min: 0 }),
  cashback: optionalNumber({ min: 0 }),
  notes: optionalText(2000),
});
export type PropertyInput = z.input<typeof propertySchema>;
export type PropertyValues = z.output<typeof propertySchema>;

const optionalId = z
  .string()
  .nullable()
  .transform((v) => (v ? v : null));

export const checklistItemSchema = z.object({
  category_id: z.string().min(1, "กรุณาเลือกหมวด"),
  code: z.string().trim().max(30).default(""),
  room_id: optionalId,
  title: z.string().trim().min(1, "กรุณาระบุหัวข้อ").max(300),
  description: optionalText(2000),
  method: optionalText(2000),
  acceptance_criteria: optionalText(2000),
  priority: z.enum(PRIORITIES),
  scope: z.enum(INSPECTION_SCOPES),
});
export type ChecklistItemInput = z.input<typeof checklistItemSchema>;
export type ChecklistItemValues = z.output<typeof checklistItemSchema>;

export const defectSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุปัญหาที่พบ").max(300),
  description: optionalText(3000),
  category: optionalText(200),
  room_id: optionalId,
  severity: z.enum(SEVERITIES),
  requires_engineer: z.boolean(),
  recommendation: optionalText(2000),
  due_date: optionalDate,
});
export type DefectInput = z.input<typeof defectSchema>;
export type DefectValues = z.output<typeof defectSchema>;

export const roomSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อห้อง").max(120),
  floor: optionalText(40),
});
export type RoomInput = z.input<typeof roomSchema>;
export type RoomValues = z.output<typeof roomSchema>;

export const transitionNoteSchema = z.string().trim().max(2000);

const email = z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง");
const password = z
  .string()
  .min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร")
  .max(72, "รหัสผ่านยาวเกินไป")
  .regex(/[A-Za-z]/, "ต้องมีตัวอักษรภาษาอังกฤษ")
  .regex(/\d/, "ต้องมีตัวเลข");

export const loginSchema = z.object({ email, password: z.string().min(1, "กรุณาระบุรหัสผ่าน") });
export const registerSchema = z
  .object({ full_name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(120), email, password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "รหัสผ่านไม่ตรงกัน", path: ["confirm"] });
export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "รหัสผ่านไม่ตรงกัน", path: ["confirm"] });
export const profileSchema = z.object({ full_name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(120) });
