"use client";
import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, FileSpreadsheet, FileText, HardDriveDownload, HardDriveUpload, Printer } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { loadReportData } from "@/lib/export/report-data";
import { backupFileName, createBackup, restoreBackup } from "@/lib/export/backup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { ReportView } from "@/features/reports/report-view";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Waits (max ~8s) until report photos have resolved so the printout is never missing pictures. */
async function photosReady() {
  const deadline = Date.now() + 8000;
  while (document.querySelector("#report-print [data-photo-loading]") && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  await Promise.all([...document.querySelectorAll<HTMLImageElement>("#report-print img")].map((i) => i.decode().catch(() => undefined)));
}

export default function ReportsPage() {
  const ws = useWorkspace();
  const auth = useAuth();
  const property = ws.property;
  const data = useLiveQuery(() => (property ? loadReportData(property.id) : null), [property?.id]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const canEdit = property ? auth.canEdit(property.project_id, ws.project?.owner_id) : false;

  if (ws.loading || data === undefined) return <div className="h-40 animate-pulse rounded-md bg-muted" />;
  if (!property || !data) return <EmptyState icon={FileText} title="ยังไม่ได้เลือกบ้าน" action={<Button asChild><Link href="/projects">ไปที่โครงการ</Link></Button>} />;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const safeName = (property.plot_number ?? property.name).replace(/[^\p{L}\p{N}-]+/gu, "_");

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="รายงาน & สำรองข้อมูล" description={`${property.name} · ตัวอย่างรายงานด้านล่างคือสิ่งที่จะพิมพ์`} />
        <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Button disabled={busy !== null} onClick={() => void run("pdf", async () => { await photosReady(); window.print(); })}>
            <Printer />{busy === "pdf" ? "กำลังเตรียม…" : "พิมพ์ / บันทึกเป็น PDF"}
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => void run("xlsx", async () => {
            const { buildWorkbook, workbookToBlob } = await import("@/lib/export/excel");
            download(await workbookToBlob(await buildWorkbook(data)), `TON-Report-${safeName}.xlsx`);
            toast.success("ดาวน์โหลด Excel แล้ว");
          })}><FileSpreadsheet />ดาวน์โหลด Excel</Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => void run("backup", async () => {
            const backup = await createBackup({ includePhotos: true });
            download(new Blob([JSON.stringify(backup)], { type: "application/json" }), backupFileName());
            toast.success("สำรองข้อมูลทั้งหมด (รวมรูป) แล้ว");
          })}><HardDriveDownload />สำรองข้อมูล (JSON)</Button>
          <Button variant="outline" disabled={busy !== null || !canEdit} onClick={() => fileRef.current?.click()}><HardDriveUpload />กู้คืนจากไฟล์สำรอง</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden data-testid="restore-input" onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void run("restore", async () => {
              const res = await restoreBackup(JSON.parse(await file.text()));
              toast.success(`กู้คืนแล้ว ${res.applied} รายการ (ข้าม ${res.skipped} รายการที่ใหม่กว่าอยู่แล้ว, รูป ${res.photos})`);
            });
          }} />
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4"><Download className="mr-1 inline size-3" aria-hidden />PDF: เลือก “บันทึกเป็น PDF” ในหน้าต่างพิมพ์ (ทำงานแบบออฟไลน์ได้ และแสดงภาษาไทยถูกต้อง) · ไฟล์สำรองมีทุกบ้าน ทุกโครงการ และรูปในเครื่องนี้ กู้คืนจะไม่ทับข้อมูลที่ใหม่กว่า</p>
        </Card>
      </div>
      <ReportView data={data} />
    </>
  );
}
