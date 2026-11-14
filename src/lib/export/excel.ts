import { TON_AI, TON_AI_CREDIT_TEXT, tonAiCopyright } from "@/lib/brand/ton-ai";
import type { Workbook } from "exceljs";
import { computeClaimDeadline } from "@/lib/domain/deadline";
import { DEFECT_STATUS_META, ENGINEERING_DISCLAIMER, ITEM_STATUS_META, PRIORITY_META, SCOPE_META, SEVERITY_META } from "@/lib/domain/labels";
import { checklistStats, defectStats } from "@/lib/domain/stats";
import { DEFECT_STATUSES, ITEM_STATUSES, SEVERITIES } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ReportData } from "./report-data";

const NAVY = "FF0B2545";
const HEADER_FONT = { name: "Sarabun", bold: true, color: { argb: "FFFFFFFF" } };
const BASE_FONT = { name: "Sarabun", size: 11 };

const SEVERITY_FILL: Record<string, string> = { LOW: "FFE2E8F0", MEDIUM: "FFCFFAFE", HIGH: "FFFEF3C7", CRITICAL: "FFFECACA" };
const ITEM_FILL: Record<string, string> = { PASS: "FFDCFCE7", FAIL: "FFFECACA", NEEDS_REINSPECTION: "FFFEF3C7", NOT_APPLICABLE: "FFE2E8F0" };
const DEFECT_FILL: Record<string, string> = { OPEN: "FFFECACA", SUBMITTED: "FFEDE9FE", IN_PROGRESS: "FFFEF3C7", FIXED: "FFCFFAFE", VERIFIED: "FFDCFCE7", REOPENED: "FFFECDD3" };

interface Col { header: string; key: string; width: number }

function addTable(wb: Workbook, name: string, columns: Col[], rows: Record<string, string | number>[], fills: Record<string, Record<string, string>> = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: { font: BASE_FONT, alignment: { vertical: "top", wrapText: true } } }));
  const header = ws.getRow(1);
  header.font = HEADER_FONT;
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 22;
  for (const r of rows) {
    const row = ws.addRow(r);
    for (const [key, map] of Object.entries(fills)) {
      const raw = (r as Record<string, unknown>)[`_${key}`];
      const argb = typeof raw === "string" ? map[raw] : undefined;
      if (argb) row.getCell(key).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  }
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

/** Builds the 4-sheet workbook (Summary / Checklist / Defects / History). Pure: no DOM or DB access. */
export async function buildWorkbook(data: ReportData): Promise<Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "TON Home Inspector";
  wb.company = TON_AI.name;
  wb.lastModifiedBy = TON_AI.name;
  wb.description = `${TON_AI_CREDIT_TEXT} · ${TON_AI.url}`;
  wb.created = new Date(data.generatedAt);

  const { property, project } = data;
  const cs = checklistStats(data.items);
  const ds = defectStats(data.defects);
  const deadline = computeClaimDeadline({ transferDateActual: property.transfer_date_actual, transferDatePlanned: property.transfer_date_planned, windowDays: property.claim_window_days });
  const roomName = new Map(data.rooms.map((r) => [r.id, r.floor ? `${r.floor} - ${r.name}` : r.name]));
  const catName = new Map(data.categories.map((c) => [c.id, c.name]));
  const defectCode = new Map(data.defects.map((d) => [d.id, d.code]));
  const photoCount = new Map<string, number>();
  for (const p of data.photos) if (p.defect_id) photoCount.set(p.defect_id, (photoCount.get(p.defect_id) ?? 0) + 1);
  const defectsByItem = new Map<string, string[]>();
  for (const d of data.defects) if (d.item_id) defectsByItem.set(d.item_id, [...(defectsByItem.get(d.item_id) ?? []), d.code]);

  // ── Summary ──
  const s = wb.addWorksheet("สรุป", { views: [{ showGridLines: false }] });
  s.columns = [{ width: 34 }, { width: 44 }, { width: 14 }];
  const put = (label: string, value: string | number, bold = false) => {
    const r = s.addRow([label, value]);
    r.font = { ...BASE_FONT, bold };
    r.getCell(1).font = { ...BASE_FONT, bold: true };
    r.getCell(2).alignment = { horizontal: "left", wrapText: true };
  };
  const heading = (text: string) => {
    s.addRow([]);
    const r = s.addRow([text]);
    r.font = { ...HEADER_FONT };
    for (let c = 1; c <= 3; c++) r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  };
  s.addRow(["รายงานตรวจรับบ้าน — TON Home Inspector"]).font = { name: "Sarabun", size: 16, bold: true, color: { argb: NAVY } };
  s.addRow([`สร้างเมื่อ ${formatDateTime(data.generatedAt)}`]).font = { ...BASE_FONT, color: { argb: "FF64748B" } };
  heading("ข้อมูลโครงการและบ้าน");
  put("โครงการ", project?.name ?? "-");
  put("ผู้พัฒนา", project?.developer ?? "-");
  put("บ้าน", property.name);
  put("เลขแปลง", property.plot_number ?? "-");
  put("แบบบ้าน", property.house_model ?? "-");
  put("ผู้ตรวจ", property.inspection_owner ?? "-");
  put("วันโอนตามเอกสารจอง (อ้างอิง)", formatDate(property.transfer_date_planned));
  put("วันจดทะเบียนโอนจริง", property.transfer_date_actual ? formatDate(property.transfer_date_actual) : "ยังไม่ได้บันทึก");
  put(`วันสุดท้ายแจ้งเก็บงาน (${property.claim_window_days} วัน)`, deadline.deadline ? formatDate(deadline.deadline) : "คำนวณเมื่อบันทึกวันโอนจริง");
  heading("ผลการตรวจ Checklist");
  put("รายการทั้งหมด", cs.total);
  for (const st of ITEM_STATUSES) put(ITEM_STATUS_META[st].label, cs.counts[st]);
  put("ความคืบหน้า (%)", cs.progressPct, true);
  put("อัตราผ่าน (%)", cs.passRatePct, true);
  heading("Defect");
  put("ทั้งหมด", ds.total);
  put("ปิดงานแล้ว (ตรวจซ้ำผ่าน)", ds.resolved);
  put("ยังค้าง", ds.pending);
  put("วิกฤตที่ยังไม่ปิด", ds.criticalOpen, ds.criticalOpen > 0);
  for (const sv of SEVERITIES) put(`ความรุนแรง: ${SEVERITY_META[sv].label}`, ds.bySeverity[sv]);
  for (const st of DEFECT_STATUSES) put(`สถานะ: ${DEFECT_STATUS_META[st].label}`, ds.byStatus[st]);
  heading("หมายเหตุสำคัญ");
  const note = s.addRow([ENGINEERING_DISCLAIMER]);
  s.mergeCells(note.number, 1, note.number, 3);
  note.alignment = { wrapText: true, vertical: "top" };
  note.font = BASE_FONT;
  note.height = 64;
  s.addRow([]);
  const credit = s.addRow([tonAiCopyright(new Date(data.generatedAt)), { text: TON_AI_CREDIT_TEXT, hyperlink: TON_AI.url }]);
  credit.font = { ...BASE_FONT, size: 10, color: { argb: "FF64748B" } };
  credit.getCell(2).font = { ...BASE_FONT, size: 10, underline: true, color: { argb: "FF0E7490" } };

  // ── Checklist ──
  addTable(wb, "Checklist", [
    { header: "รหัส", key: "code", width: 12 }, { header: "หมวด", key: "category", width: 22 }, { header: "ห้อง / ตำแหน่ง", key: "location", width: 26 },
    { header: "หัวข้อที่ตรวจ", key: "title", width: 44 }, { header: "ประเภทการตรวจ", key: "scope", width: 16 }, { header: "ความสำคัญ", key: "priority", width: 12 },
    { header: "ผลตรวจ", key: "status", width: 16 }, { header: "หมายเหตุ", key: "note", width: 40 }, { header: "ตรวจเมื่อ", key: "checked", width: 18 }, { header: "Defect ที่เกี่ยวข้อง", key: "defects", width: 18 },
  ], data.items.map((i) => ({
    code: i.code, category: catName.get(i.category_id) ?? "", location: (i.room_id ? roomName.get(i.room_id) : null) ?? i.location ?? "", title: i.title,
    scope: SCOPE_META[i.scope].short, priority: PRIORITY_META[i.priority].label, status: ITEM_STATUS_META[i.status].label, _status: i.status,
    note: i.note ?? "", checked: i.checked_at ? formatDateTime(i.checked_at) : "", defects: (defectsByItem.get(i.id) ?? []).join(", "),
  })), { status: ITEM_FILL });

  // ── Defects ──
  addTable(wb, "Defects", [
    { header: "รหัส", key: "code", width: 10 }, { header: "ปัญหาที่พบ", key: "title", width: 40 }, { header: "ห้อง / ตำแหน่ง", key: "location", width: 26 }, { header: "หมวดงาน", key: "category", width: 18 },
    { header: "ความรุนแรง", key: "severity", width: 13 }, { header: "สถานะ", key: "status", width: 22 }, { header: "ต้องให้วิศวกรตรวจ", key: "engineer", width: 16 },
    { header: "พบเมื่อ", key: "found", width: 18 }, { header: "กำหนดแก้", key: "due", width: 14 }, { header: "แจ้งว่าแก้แล้ว", key: "fixed", width: 18 }, { header: "ปิดงาน", key: "verified", width: 18 },
    { header: "รายละเอียด", key: "description", width: 44 }, { header: "ข้อเสนอแนะ", key: "recommendation", width: 36 }, { header: "หัวข้อตรวจ", key: "item", width: 14 }, { header: "จำนวนรูป", key: "photos", width: 10 },
  ], data.defects.map((d) => ({
    code: d.code, title: d.title, location: (d.room_id ? roomName.get(d.room_id) : null) ?? d.location ?? "", category: d.category ?? "",
    severity: SEVERITY_META[d.severity].label, _severity: d.severity, status: DEFECT_STATUS_META[d.status].label, _status: d.status,
    engineer: d.requires_engineer ? "ใช่" : "", found: formatDateTime(d.found_at), due: d.due_date ? formatDate(d.due_date) : "",
    fixed: d.fixed_at ? formatDateTime(d.fixed_at) : "", verified: d.verified_at ? formatDateTime(d.verified_at) : "",
    description: d.description ?? "", recommendation: d.recommendation ?? "", item: data.items.find((i) => i.id === d.item_id)?.code ?? "", photos: photoCount.get(d.id) ?? 0,
  })), { severity: SEVERITY_FILL, status: DEFECT_FILL });

  // ── History ──
  addTable(wb, "ประวัติ Defect", [
    { header: "Defect", key: "code", width: 10 }, { header: "วันเวลา", key: "at", width: 20 }, { header: "จากสถานะ", key: "from", width: 24 }, { header: "เป็นสถานะ", key: "to", width: 24 }, { header: "หมายเหตุ", key: "note", width: 60 },
  ], data.events.map((e) => ({
    code: defectCode.get(e.defect_id) ?? "", at: formatDateTime(e.created_at), from: e.from_status ? DEFECT_STATUS_META[e.from_status].label : "—",
    to: DEFECT_STATUS_META[e.to_status].label, _to: e.to_status, note: e.note ?? "",
  })), { to: DEFECT_FILL });

  return wb;
}

export async function workbookToBlob(wb: Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
