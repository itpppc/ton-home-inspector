"use client";
import * as React from "react";
import { Ban, Check, ChevronDown, RotateCcw, X, Repeat } from "lucide-react";
import type { ChecklistItem, ItemStatus } from "@/lib/domain/types";
import { ITEM_STATUS_META, PRIORITY_META } from "@/lib/domain/labels";
import { setItemNote, setItemStatus } from "@/lib/db/repo";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";

const OPTIONS: { status: ItemStatus; label: string; icon: React.ComponentType<{ className?: string }>; on: string }[] = [
  { status: "PASS", label: "ผ่าน", icon: Check, on: "bg-success text-white border-success" },
  { status: "FAIL", label: "ไม่ผ่าน", icon: X, on: "bg-danger text-white border-danger" },
  { status: "NEEDS_REINSPECTION", label: "ตรวจซ้ำ", icon: Repeat, on: "bg-warning text-white border-warning" },
  { status: "NOT_APPLICABLE", label: "N/A", icon: Ban, on: "bg-secondary-strong text-white border-secondary-strong" },
];

const RAIL: Record<ItemStatus, string> = {
  NOT_CHECKED: "before:bg-border",
  PASS: "before:bg-success",
  FAIL: "before:bg-danger",
  NEEDS_REINSPECTION: "before:bg-warning",
  NOT_APPLICABLE: "before:bg-secondary",
};

export const ItemCard = React.memo(function ItemCard({ item, userId, readOnly }: { item: ChecklistItem; userId: string | null; readOnly: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState(item.note ?? "");
  React.useEffect(() => setNote(item.note ?? ""), [item.note]);
  const detailsId = `d-${item.id}`;
  const showDetails = open || item.status === "FAIL" || item.status === "NEEDS_REINSPECTION";

  return (
    <article className={cn("relative overflow-hidden rounded-xl border bg-card p-3 pl-4 shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1", RAIL[item.status])} aria-label={`${item.code} ${item.title}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">{item.code}</span>
            {item.priority !== "LOW" && item.priority !== "MEDIUM" && <Badge tone={PRIORITY_META[item.priority].tone}>{PRIORITY_META[item.priority].label}</Badge>}
            {item.status !== "NOT_CHECKED" && <Badge tone={ITEM_STATUS_META[item.status].tone}>{ITEM_STATUS_META[item.status].label}</Badge>}
          </div>
          <h3 className="font-medium leading-snug">{item.title}</h3>
          {item.location && <p className="text-xs text-muted-foreground">{item.location}</p>}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={detailsId} className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-muted" aria-label="วิธีตรวจและเกณฑ์">
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <dl id={detailsId} className="mt-2 space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
          {item.description && <div><dt className="font-semibold">รายละเอียด</dt><dd>{item.description}</dd></div>}
          {item.method && <div><dt className="font-semibold">วิธีตรวจ</dt><dd>{item.method}</dd></div>}
          {item.acceptance_criteria && <div><dt className="font-semibold">เกณฑ์ผ่าน</dt><dd>{item.acceptance_criteria}</dd></div>}
          {item.checked_at && <div className="text-xs text-muted-foreground">ตรวจเมื่อ {formatDateTime(item.checked_at)}</div>}
        </dl>
      )}

      <div role="group" aria-label="ผลการตรวจ" className="mt-3 grid grid-cols-4 gap-1.5">
        {OPTIONS.map(({ status, label, icon: Icon, on }) => {
          const active = item.status === status;
          return (
            <button key={status} type="button" disabled={readOnly} aria-pressed={active}
              onClick={() => void setItemStatus(item.id, active ? "NOT_CHECKED" : status, userId)}
              className={cn("flex min-h-11 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 sm:flex-row sm:gap-1.5 sm:text-sm", active ? on : "bg-card hover:bg-muted")}>
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
      {item.status !== "NOT_CHECKED" && !readOnly && (
        <button type="button" onClick={() => void setItemStatus(item.id, "NOT_CHECKED", userId)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="size-3" />ล้างผลตรวจ
        </button>
      )}
    </article>
  );
});
