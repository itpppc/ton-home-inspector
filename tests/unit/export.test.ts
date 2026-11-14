import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { InspectorDB, setDB, getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import * as repo from "@/lib/db/repo";
import { createDefect, transitionDefect } from "@/lib/db/defects";
import { savePhoto } from "@/lib/db/photos";
import { buildWorkbook, workbookToBlob } from "@/lib/export/excel";
import { loadReportData } from "@/lib/export/report-data";
import { createBackup, parseBackup, restoreBackup } from "@/lib/export/backup";
import { checklistStats } from "@/lib/domain/stats";

let n = 0;
beforeEach(() => setDB(new InspectorDB(`export-${++n}`)));

async function populate() {
  await repo.seedDefaultData(null);
  const db = getDB();
  const property = (await db.properties.toArray())[0];
  const items = await db.checklist_items.filter(alive).toArray();
  await repo.setItemStatus(items[0].id, "PASS", "u1");
  await repo.setItemStatus(items[1].id, "FAIL", "u1");
  const defect = await createDefect({
    property, itemId: items[1].id, actor: "u1",
    values: { title: "น้ำซึมที่มุมผนัง", description: "ซึมหลังฝนตก", category: "งานผนัง", room_id: items[1].room_id, severity: "HIGH", requires_engineer: true, recommendation: "ซ่อมและทดสอบน้ำซ้ำ", due_date: null },
  });
  await transitionDefect(defect.id, "SUBMITTED", "ส่งอีเมลแล้ว", "u1");
  const photo = await savePhoto({ target: { project_id: property.project_id, property_id: property.id, defect_id: defect.id }, kind: "DEFECT", blob: new Blob([new Uint8Array([9, 8, 7, 6])], { type: "image/jpeg" }), width: 4, height: 4 });
  return { db, property, defect, photo, items };
}

describe("Excel export", () => {
  it("has Summary / Checklist / Defects / History with correct Thai content", async () => {
    const { property, items, defect } = await populate();
    const data = (await loadReportData(property.id))!;
    const wb = await buildWorkbook(data);
    const blob = await workbookToBlob(wb);
    expect(blob.size).toBeGreaterThan(1000);

    const read = new ExcelJS.Workbook();
    await read.xlsx.load(await blob.arrayBuffer());
    expect(read.worksheets.map((w) => w.name)).toEqual(["สรุป", "Checklist", "Defects", "ประวัติ Defect"]);

    const checklist = read.getWorksheet("Checklist")!;
    expect(checklist.rowCount).toBe(items.length + 1); // header + every item
    const failRow = checklist.getRows(2, items.length)!.find((r) => r.getCell(1).value === items[1].code)!;
    expect(failRow.getCell(7).value).toBe("ไม่ผ่าน");
    expect(failRow.getCell(10).value).toBe(defect.code);

    const defects = read.getWorksheet("Defects")!;
    expect(defects.rowCount).toBe(2);
    expect(defects.getRow(2).getCell(2).value).toBe("น้ำซึมที่มุมผนัง");
    expect(defects.getRow(2).getCell(5).value).toBe("สูง");
    expect(defects.getRow(2).getCell(7).value).toBe("ใช่");
    expect(defects.getRow(2).getCell(15).value).toBe(1);

    const history = read.getWorksheet("ประวัติ Defect")!;
    expect(history.rowCount).toBe(3); // OPEN, SUBMITTED
    expect(history.getRow(3).getCell(5).value).toBe("ส่งอีเมลแล้ว");

    const summary = read.getWorksheet("สรุป")!;
    const text: string[] = [];
    summary.eachRow((r) => r.eachCell((c) => text.push(String(c.value))));
    expect(text).toContain("1240-032002");
    expect(text.some((t) => t.includes("ไม่ใช่การรับรองความปลอดภัย"))).toBe(true);
    const stats = checklistStats(data.items);
    expect(text).toContain(String(stats.total));
  });

  it("works for a property with no defects", async () => {
    await repo.seedDefaultData(null);
    const property = (await getDB().properties.toArray())[0];
    const wb = await buildWorkbook((await loadReportData(property.id))!);
    expect(wb.getWorksheet("Defects")!.rowCount).toBe(1);
  });
});

describe("JSON backup / restore", () => {
  it("round-trips everything (rows, soft-deletes, photo files) into an empty device", async () => {
    const { db, defect, photo, items } = await populate();
    await repo.deleteItem(items[5].id); // a soft-deleted row must survive too
    const backup = JSON.parse(JSON.stringify(await createBackup({ includePhotos: true })));

    setDB(new InspectorDB(`export-restore-${++n}`));
    const fresh = getDB();
    const res = await restoreBackup(backup);
    expect(res.photos).toBe(1);
    expect(res.skipped).toBe(0);
    for (const t of ["projects", "properties", "rooms", "checklist_categories", "checklist_items", "defects", "defect_events", "photos"] as const) {
      expect(await fresh.table(t).count()).toBe(await db.table(t).count());
    }
    expect((await fresh.checklist_items.get(items[5].id))!.deleted_at).not.toBeNull();
    expect((await fresh.defects.get(defect.id))!.status).toBe("SUBMITTED");
    const blob = (await fresh.photo_blobs.get(photo.id))!;
    expect(new Uint8Array(await blob.blob.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7, 6]));
    expect(blob.uploaded).toBe(0);
    // restored data is queued for cloud sync
    expect(await fresh.outbox.get(`defects:${defect.id}`)).toBeTruthy();
    expect(await fresh.outbox.get(`photos:${photo.id}`)).toBeTruthy();
  });

  it("never overwrites newer local data with an older backup (LWW)", async () => {
    const { db, items } = await populate();
    const backup = await createBackup({ includePhotos: false });
    await new Promise((r) => setTimeout(r, 5));
    await repo.setItemStatus(items[0].id, "FAIL", "u2"); // newer than the backup
    const res = await restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect((await db.checklist_items.get(items[0].id))!.status).toBe("FAIL");
    expect(res.skipped).toBeGreaterThan(0);
    expect(backup.photos).toBeUndefined();
  });

  it("rejects corrupt or foreign files without changing anything", async () => {
    const { db } = await populate();
    const before = await db.checklist_items.count();
    const good = JSON.parse(JSON.stringify(await createBackup({ includePhotos: false })));
    expect(() => parseBackup(null)).toThrow();
    expect(() => parseBackup({ ...good, app: "other" })).toThrow("ไม่ใช่ไฟล์สำรอง");
    expect(() => parseBackup({ ...good, version: 99 })).toThrow("เวอร์ชัน");
    const broken = { ...good, tables: { ...good.tables, defects: [{ id: 1 }] } };
    await expect(restoreBackup(broken)).rejects.toThrow();
    expect(await db.checklist_items.count()).toBe(before);
    expect(await db.defects.count()).toBe(1);
  });
});
