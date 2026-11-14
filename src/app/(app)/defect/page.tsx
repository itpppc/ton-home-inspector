"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bug, CheckCircle2, ClipboardCheck, HardHat, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { useIdParam } from "@/components/app/use-id-param";
import { canTransition, deleteDefect, transitionDefect, updateDefect } from "@/lib/db/defects";
import { DEFECT_STATUS_META, DEFECT_TRANSITIONS, ENGINEERING_DISCLAIMER, SEVERITY_META } from "@/lib/domain/labels";
import type { DefectStatus } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { DefectForm } from "@/features/defects/defect-form";
import { useDefect } from "@/features/defects/use-defects";
import { PhotoCapture } from "@/features/photos/photo-capture";
import { PhotoGallery, usePhotos } from "@/features/photos/photo-gallery";
import { formatDate, formatDateTime } from "@/lib/utils";

const ACTION_LABEL: Record<DefectStatus, string> = {
  OPEN: "ย้อนกลับเป็น “พบปัญหา”",
  SUBMITTED: "แจ้งโครงการแล้ว",
  IN_PROGRESS: "โครงการกำลังแก้ไข",
  FIXED: "โครงการแจ้งว่าแก้แล้ว",
  VERIFIED: "ตรวจซ้ำผ่าน — ปิดงาน",
  REOPENED: "ตรวจซ้ำไม่ผ่าน",
};

function DefectDetail({ id }: { id: string }) {
  const router = useRouter();
  const auth = useAuth();
  const ws = useWorkspace();
  const data = useDefect(id);
  const before = usePhotos({ defectId: id, kinds: ["DEFECT"] });
  const after = usePhotos({ defectId: id, kinds: ["AFTER_FIX"] });
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState<DefectStatus | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (data === undefined) return <div className="h-40 animate-pulse rounded-md bg-muted" />;
  if (data === null) return <EmptyState icon={Bug} title="ไม่พบ Defect นี้" action={<Button asChild variant="outline"><Link href="/defects">กลับรายการ Defect</Link></Button>} />;
  const { defect, events, item, rooms, categories } = data;
  const project = ws.projects.find((p) => p.id === defect.project_id);
  const canEdit = auth.canEdit(defect.project_id, project?.owner_id);
  const next = DEFECT_TRANSITIONS[defect.status].filter((s) => canTransition(defect.status, s));
  const reinspection = defect.status === "FIXED";
  const general = next.filter((s) => s !== "VERIFIED" && s !== "REOPENED" || (!reinspection && s === "REOPENED"));

  async function confirmTransition() {
    if (!pending) return;
    setBusy(true);
    try {
      await transitionDefect(defect.id, pending, note, auth.userId);
      toast.success(`เปลี่ยนสถานะเป็น “${DEFECT_STATUS_META[pending].label}” แล้ว`);
      setPending(null);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const target = { project_id: defect.project_id, property_id: defect.property_id, defect_id: defect.id };
  const afterCount = after?.length ?? 0;

  return (
    <>
      <Link href="/defects" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Defect ทั้งหมด</Link>
      <PageHeader title={`${defect.code} · ${defect.title}`}
        description={<span className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge tone={SEVERITY_META[defect.severity].tone}>{SEVERITY_META[defect.severity].label}</Badge>
          <Badge tone={DEFECT_STATUS_META[defect.status].tone} data-testid="defect-status">{DEFECT_STATUS_META[defect.status].label}</Badge>
          {defect.requires_engineer && <Badge tone="accent"><HardHat className="size-3" aria-hidden />ต้องให้วิศวกรตรวจ</Badge>}
        </span>}
        actions={canEdit && (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil />แก้ไข</Button>
            <Button variant="outline" className="text-danger" onClick={async () => {
              if (!window.confirm(`ลบ ${defect.code}? (รูปและประวัติจะถูกซ่อน)`)) return;
              await deleteDefect(defect.id, auth.userId);
              toast.success("ลบ Defect แล้ว");
              router.replace("/defects");
            }}><Trash2 />ลบ</Button>
          </>
        )}
      />

      {defect.requires_engineer && (
        <p role="note" className="mb-4 flex gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm"><HardHat className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{ENGINEERING_DISCLAIMER}</p>
      )}

      {canEdit && reinspection && (
        <Card className="mb-4 border-secondary/40" data-testid="reinspection-panel">
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5" aria-hidden />ตรวจซ้ำ (Reinspection)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">โครงการแจ้งว่าแก้แล้ว — ตรวจหน้างานจริง ถ่ายรูปหลังแก้ไข แล้วเลือกผล</p>
            {afterCount === 0 && <p className="text-sm text-warning-strong">ยังไม่มีรูปหลังแก้ไข แนะนำให้ถ่ายก่อนสรุปผล</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="default" className="bg-success hover:bg-success/90" onClick={() => { setNote(""); setPending("VERIFIED"); }}><CheckCircle2 />{ACTION_LABEL.VERIFIED}</Button>
              <Button variant="destructive" onClick={() => { setNote(""); setPending("REOPENED"); }}><XCircle />{ACTION_LABEL.REOPENED} (เปิดใหม่)</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>รายละเอียด</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">ตำแหน่ง</dt><dd>{defect.location ?? "-"}</dd></div>
                <div><dt className="text-muted-foreground">หมวดงาน</dt><dd>{defect.category ?? "-"}</dd></div>
                <div><dt className="text-muted-foreground">พบเมื่อ</dt><dd>{formatDateTime(defect.found_at)}</dd></div>
                <div><dt className="text-muted-foreground">กำหนดแก้ไข</dt><dd>{defect.due_date ? formatDate(defect.due_date) : "-"}</dd></div>
                {defect.fixed_at && <div><dt className="text-muted-foreground">โครงการแจ้งแก้แล้ว</dt><dd>{formatDateTime(defect.fixed_at)}</dd></div>}
                {defect.verified_at && <div><dt className="text-muted-foreground">ปิดงาน (ตรวจซ้ำผ่าน)</dt><dd>{formatDateTime(defect.verified_at)}</dd></div>}
                {item && <div className="sm:col-span-2"><dt className="text-muted-foreground">หัวข้อตรวจที่เกี่ยวข้อง</dt><dd><span className="font-mono text-xs">{item.code}</span> {item.title}</dd></div>}
                {defect.description && <div className="sm:col-span-2"><dt className="text-muted-foreground">รายละเอียด</dt><dd className="whitespace-pre-wrap">{defect.description}</dd></div>}
                {defect.recommendation && <div className="sm:col-span-2"><dt className="text-muted-foreground">ข้อเสนอแนะ</dt><dd className="whitespace-pre-wrap">{defect.recommendation}</dd></div>}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2"><CardTitle>รูปก่อนแก้ไข</CardTitle>{canEdit && <PhotoCapture target={target} kind="DEFECT" size="sm" />}</CardHeader>
            <CardContent><PhotoGallery photos={before} canDelete={canEdit} emptyText="ยังไม่มีรูป — ถ่ายรูปหลักฐานของปัญหานี้" /></CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2"><CardTitle>รูปหลังแก้ไข</CardTitle>{canEdit && <PhotoCapture target={target} kind="AFTER_FIX" size="sm" label="ถ่ายหลังแก้" />}</CardHeader>
            <CardContent><PhotoGallery photos={after} canDelete={canEdit} emptyText="ยังไม่มีรูปหลังแก้ไข" /></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {canEdit && general.length > 0 && (
            <Card>
              <CardHeader><CardTitle>เปลี่ยนสถานะ</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {general.map((s) => (
                  <Button key={s} variant={s === "REOPENED" ? "outline" : "secondary"} onClick={() => { setNote(""); setPending(s); }}>
                    {s === "REOPENED" && <RotateCcw />}{ACTION_LABEL[s]}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>ประวัติสถานะ</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4" data-testid="defect-timeline">
                {events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full" style={{ background: DEFECT_STATUS_META[e.to_status].color }} aria-hidden />
                    <p className="font-medium">{DEFECT_STATUS_META[e.to_status].label}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                    {e.note && <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        {pending && (
          <DialogContent title={ACTION_LABEL[pending]} description={`${DEFECT_STATUS_META[defect.status].label} → ${DEFECT_STATUS_META[pending].label}`}>
            <div className="grid gap-3">
              <label htmlFor="tr-note" className="text-sm font-medium">{pending === "REOPENED" ? "เหตุผลที่ตรวจซ้ำไม่ผ่าน" : "หมายเหตุ (ถ้ามี)"}{pending === "REOPENED" && <span className="text-danger" aria-hidden> *</span>}</label>
              <Textarea id="tr-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <Button disabled={busy || (pending === "REOPENED" && !note.trim())} onClick={() => void confirmTransition()}>{busy ? "กำลังบันทึก…" : "ยืนยัน"}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        {editing && (
          <DialogContent title="แก้ไข Defect" className="sm:max-w-2xl">
            <DefectForm rooms={rooms} categories={categories} initial={defect} submitLabel="บันทึก" onSubmit={async (v) => {
              try {
                await updateDefect(defect.id, v);
                toast.success("บันทึกแล้ว");
                setEditing(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
              }
            }} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function DefectRoute() {
  const id = useIdParam();
  if (!id) return <EmptyState icon={Bug} title="ไม่พบ Defect นี้" action={<Button asChild variant="outline"><Link href="/defects">กลับรายการ Defect</Link></Button>} />;
  return <DefectDetail id={id} />;
}

export default function DefectPage() {
  return <React.Suspense><DefectRoute /></React.Suspense>;
}
