"use client";
import * as React from "react";
import Link from "next/link";
import { Ban, Bug, Check, ChevronDown, HardHat, RotateCcw, X, Repeat } from "lucide-react";
import { toast } from "sonner";
import type { ChecklistItem, Defect, ItemStatus, Property, Room } from "@/lib/domain/types";
import { DEFECT_STATUS_META, ITEM_STATUS_META, PRIORITY_META, SCOPE_META, SEVERITY_META } from "@/lib/domain/labels";
import { setItemNote, setItemStatus } from "@/lib/db/repo";
import { createDefect } from "@/lib/db/defects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { DefectForm } from "@/features/defects/defect-form";
import { PhotoCapture } from "@/features/photos/photo-capture";
import { PhotoGallery, usePhotos } from "@/features/photos/photo-gallery";
import { cn, formatDateTime } from "@/lib/utils";

/** Shared (referentially stable) context so memoised cards do not re-render on every filter change. */
export interface ItemShared {
  property: Pick<Property, "id" | "project_id">;
  rooms: Room[];
  categories: string[];
}

function ItemPhotos({ item, readOnly }: { item: ChecklistItem; readOnly: boolean }) {
  const photos = usePhotos({ itemId: item.id });
  return (
    <div className="mt-2 space-y-2">
      <PhotoGallery photos={photos} canDelete={!readOnly} />
      {!readOnly && <PhotoCapture size="sm" kind="ITEM" label="ถ่ายรูปประกอบ" target={{ project_id: item.project_id, property_id: item.property_id, item_id: item.id }} />}
    </div>
  );
}

const OPTIONS: { status: ItemStatus; label: string; icon: React.ComponentType<{ className?: string }>; on: string }[] = [
  { status: "PASS", label: "ผ่าน", icon: Check, on: "bg-success text-white" },
  { status: "FAIL", label: "ไม่ผ่าน", icon: X, on: "bg-danger text-white" },
  { status: "NEEDS_REINSPECTION", label: "ตรวจซ้ำ", icon: Repeat, on: "bg-warning-strong text-white dark:text-black" },
  { status: "NOT_APPLICABLE", label: "N/A", icon: Ban, on: "bg-secondary text-secondary-foreground" },
];

/** Rubber-stamp colour per result (text colour drives the double border). */
const STAMP: Record<ItemStatus, string> = {
  NOT_CHECKED: "",
  PASS: "text-success",
  FAIL: "text-danger",
  NEEDS_REINSPECTION: "text-warning-strong",
  NOT_APPLICABLE: "text-secondary",
};

const RAIL: Record<ItemStatus, string> = {
  NOT_CHECKED: "before:bg-border",
  PASS: "before:bg-success",
  FAIL: "before:bg-danger",
  NEEDS_REINSPECTION: "before:bg-warning",
  NOT_APPLICABLE: "before:bg-secondary",
};

export const ItemCard = React.memo(function ItemCard({ item, userId, readOnly, shared, categoryName, defects }: { item: ChecklistItem; userId: string | null; readOnly: boolean; shared?: ItemShared; categoryName: string; defects: Defect[] }) {
  const [open, setOpen] = React.useState(false);
  const [defectOpen, setDefectOpen] = React.useState(false);
  const unresolved = defects.filter((d) => d.status !== "VERIFIED");
  const [note, setNote] = React.useState(item.note ?? "");
  React.useEffect(() => setNote(item.note ?? ""), [item.note]);
  const detailsId = `d-${item.id}`;
  const showDetails = open || item.status === "FAIL" || item.status === "NEEDS_REINSPECTION";

  return (
    <article className={cn("relative overflow-hidden rounded-md border bg-card p-3 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1", RAIL[item.status], item.status === "NOT_CHECKED" && "border-dashed")} aria-label={`${item.code} ${item.title}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">{item.code}</span>
            {item.priority !== "LOW" && item.priority !== "MEDIUM" && <Badge tone={PRIORITY_META[item.priority].tone}>{PRIORITY_META[item.priority].label}</Badge>}
            {item.scope === "ENGINEERING" && <Badge tone={SCOPE_META.ENGINEERING.tone}><HardHat className="size-3" aria-hidden />{SCOPE_META.ENGINEERING.short}</Badge>}
          </div>
          <h3 className="font-medium leading-snug">{item.title}</h3>
          {item.location && <p className="text-xs text-muted-foreground">{item.location}</p>}
        </div>
        {item.status !== "NOT_CHECKED" && (
          <span className={cn("stamp mt-1 shrink-0 -rotate-3 bg-card", STAMP[item.status])}>{ITEM_STATUS_META[item.status].label}</span>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={detailsId} className="grid size-10 shrink-0 place-items-center rounded-md hover:bg-muted" aria-label="วิธีตรวจและเกณฑ์">
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <dl id={detailsId} className="mt-2 space-y-1.5 border-l-2 border-foreground/70 bg-muted/50 p-3 text-sm">
          {item.description && <div><dt className="font-semibold">รายละเอียด</dt><dd>{item.description}</dd></div>}
          {item.method && <div><dt className="font-semibold">วิธีตรวจ</dt><dd>{item.method}</dd></div>}
          {item.acceptance_criteria && <div><dt className="font-semibold">เกณฑ์ผ่าน</dt><dd>{item.acceptance_criteria}</dd></div>}
          {item.checked_at && <div className="text-xs text-muted-foreground">ตรวจเมื่อ {formatDateTime(item.checked_at)}</div>}
        </dl>
      )}

      <div role="group" aria-label="ผลการตรวจ" className="mt-3 grid grid-cols-4 divide-x divide-input overflow-hidden rounded-md border border-input">
        {OPTIONS.map(({ status, label, icon: Icon, on }) => {
          const active = item.status === status;
          return (
            <button key={status} type="button" disabled={readOnly} aria-pressed={active}
              onClick={() => {
                const nextStatus = active ? "NOT_CHECKED" : status;
                if (unresolved.length > 0 && (nextStatus === "PASS" || nextStatus === "NOT_CHECKED")) {
                  toast.error("หัวข้อนี้มี Defect ที่ยังไม่ปิด — ปิดงานที่หน้า Defect (ตรวจซ้ำผ่าน) แล้วระบบจะเปลี่ยนเป็น “ผ่าน” ให้เอง");
                  return;
                }
                void setItemStatus(item.id, nextStatus, userId);
              }}
              className={cn("flex min-h-12 flex-col items-center justify-center text-xs font-semibold transition-colors disabled:opacity-50 sm:min-h-11 sm:flex-row sm:gap-1.5 sm:text-sm", active ? on : "bg-card hover:bg-muted")}>
              <Icon className="size-4" aria-hidden />{label}
            </button>
          );
        })}
      </div>

      {showDetails && (
        <div className="mt-2">
          <label htmlFor={`n-${item.id}`} className="sr-only">บันทึกเพิ่มเติม</label>
          <Textarea id={`n-${item.id}`} rows={2} value={note} disabled={readOnly} placeholder="บันทึกสิ่งที่พบ ตำแหน่ง ขนาด…"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if ((item.note ?? "") !== note.trim()) void setItemNote(item.id, note); }} />
        </div>
      )}
      {shared && (item.status === "FAIL" || defects.length > 0) && (
        <div className="mt-2 space-y-1.5 border-l-2 border-danger bg-danger/5 p-2.5" data-testid="item-defects">
          {defects.map((d) => (
            <Link key={d.id} href={`/defect?id=${d.id}`} className="flex flex-wrap items-center gap-1.5 text-sm hover:underline">
              <Bug className="size-4 text-danger" aria-hidden /><span className="font-mono text-xs">{d.code}</span>
              <Badge tone={SEVERITY_META[d.severity].tone}>{SEVERITY_META[d.severity].label}</Badge>
              <Badge tone={DEFECT_STATUS_META[d.status].tone}>{DEFECT_STATUS_META[d.status].label}</Badge>
            </Link>
          ))}
          {item.status === "FAIL" && unresolved.length === 0 && !readOnly && (
            <Button size="sm" variant="destructive" onClick={() => setDefectOpen(true)}><Bug />บันทึกเป็น Defect</Button>
          )}
        </div>
      )}
      {showDetails && <ItemPhotos item={item} readOnly={readOnly} />}
      {shared && (
        <Dialog open={defectOpen} onOpenChange={setDefectOpen}>
          {defectOpen && (
            <DialogContent title="บันทึกเป็น Defect" description={`${item.code} ${item.title}`} className="sm:max-w-2xl">
              <DefectForm rooms={shared.rooms} categories={shared.categories}
                prefill={{ title: item.title, description: item.note, category: categoryName, room_id: item.room_id, priority: item.priority, scope: item.scope }}
                onSubmit={async (v) => {
                  try {
                    const d = await createDefect({ property: shared.property, values: v, itemId: item.id, actor: userId });
                    toast.success(`บันทึก ${d.code} แล้ว — ถ่ายรูปหลักฐานได้ที่หน้า Defect`);
                    setDefectOpen(false);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
                  }
                }} />
            </DialogContent>
          )}
        </Dialog>
      )}
      {item.status !== "NOT_CHECKED" && !readOnly && (
        <button type="button" onClick={() => void setItemStatus(item.id, "NOT_CHECKED", userId)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="size-3" />ล้างผลตรวจ
        </button>
      )}
    </article>
  );
});
