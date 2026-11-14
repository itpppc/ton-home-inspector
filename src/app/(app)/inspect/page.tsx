"use client";
import * as React from "react";
import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { useChecklist } from "@/features/checklist/use-checklist";
import { ItemCard } from "@/features/checklist/item-card";
import { checklistStats } from "@/lib/domain/stats";
import { ITEM_STATUSES, type Defect, type ItemStatus } from "@/lib/domain/types";
import { ITEM_STATUS_META } from "@/lib/domain/labels";
import { Progress } from "@/components/ui/progress";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { DeadlineBanner } from "@/components/app/deadline-banner";
import { roomLabel } from "@/lib/seed/checklist-template";

const PAGE_SIZE = 40;
const NO_DEFECTS: Defect[] = [];

export default function InspectPage() {
  const ws = useWorkspace();
  const auth = useAuth();
  const data = useChecklist(ws.property?.id);
  const [category, setCategory] = React.useState("all");
  const [roomId, setRoomId] = React.useState("all");
  const [status, setStatus] = React.useState<"all" | ItemStatus>("all");
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  React.useEffect(() => setLimit(PAGE_SIZE), [category, roomId, status, deferredQuery, ws.property?.id]);

  const shared = React.useMemo(() => (data && ws.property ? { property: { id: ws.property.id, project_id: ws.property.project_id }, rooms: data.rooms, categories: data.categories.map((c) => c.name) } : null), [data, ws.property]);

  if (ws.loading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (!ws.property) return <EmptyState icon={ClipboardList} title="ยังไม่ได้เลือกบ้าน" action={<Button asChild><Link href="/projects">ไปที่โครงการ</Link></Button>} />;
  if (data.items.length === 0) {
    return <EmptyState icon={ClipboardList} title="ยังไม่มี Checklist สำหรับบ้านนี้" body="สร้าง Checklist มาตรฐานหรือเพิ่มหัวข้อเอง" action={<Button asChild><Link href={`/property?id=${ws.property.id}`}>ไปที่ข้อมูลบ้าน</Link></Button>} />;
  }

  const readOnly = !auth.canEdit(ws.property.project_id, ws.project?.owner_id);
  const roomName = new Map(data.rooms.map((r) => [r.id, roomLabel(r)]));
  const stats = checklistStats(data.items);
  const filtered = data.items.filter((i) =>
    (category === "all" || i.category_id === category) &&
    (roomId === "all" || (roomId === "none" ? !i.room_id : i.room_id === roomId)) &&
    (status === "all" || i.status === status) &&
    (!deferredQuery || `${i.code} ${i.title} ${i.room_id ? roomName.get(i.room_id) ?? "" : ""} ${i.note ?? ""}`.toLowerCase().includes(deferredQuery)),
  );
  const catOrder = new Map(data.categories.map((c, i) => [c.id, i]));
  filtered.sort((a, b) => (catOrder.get(a.category_id)! - catOrder.get(b.category_id)!) || a.sort_order - b.sort_order);
  const shown = filtered.slice(0, limit);
  const catName = new Map(data.categories.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="ตรวจบ้าน" description={`${ws.property.name} · ${ws.property.house_model ?? ""}`} />
      <DeadlineBanner property={ws.property} className="mb-3" />
      {readOnly && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">คุณมีสิทธิ์ดูอย่างเดียว (Viewer)</p>}

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-3 mb-3 space-y-2 border-b bg-background/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex items-center gap-3">
          <Progress value={stats.progressPct} label="ความคืบหน้าการตรวจ" className="flex-1" />
          <span className="text-sm font-bold tabular-nums">{stats.progressPct}%</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">{stats.checked}/{stats.total}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select aria-label="หมวด" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">ทุกหมวด</option>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({checklistStats(data.byCategory.get(c.id) ?? []).pending})</option>)}
          </Select>
          <Select aria-label="ห้อง / ตำแหน่ง" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="all">ทุกห้อง</option>
            <option value="none">ทั้งหลัง / ไม่ระบุห้อง</option>
            {data.rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
          </Select>
          <Select aria-label="สถานะ" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">ทุกสถานะ</option>
            {ITEM_STATUSES.map((s) => <option key={s} value={s}>{ITEM_STATUS_META[s].label} ({stats.counts[s]})</option>)}
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="ค้นหา" placeholder="ค้นหา…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">แสดง {Math.min(limit, filtered.length)} จาก {filtered.length} รายการ</p>
      <div className="space-y-2">
        {shown.map((item, idx) => (
          <React.Fragment key={item.id}>
            {(idx === 0 || shown[idx - 1].category_id !== item.category_id) && (
              <h2 className="pt-3 text-sm font-bold uppercase tracking-wide text-primary dark:text-secondary">{catName.get(item.category_id)}</h2>
            )}
            <ItemCard item={item} userId={auth.userId} readOnly={readOnly} shared={shared ?? undefined} categoryName={catName.get(item.category_id) ?? ""} defects={data.defectsByItem.get(item.id) ?? NO_DEFECTS} />
          </React.Fragment>
        ))}
      </div>
      {filtered.length > limit && (
        <Button variant="outline" className="mt-4 w-full" onClick={() => setLimit((l) => l + PAGE_SIZE)}>แสดงเพิ่ม ({filtered.length - limit})</Button>
      )}
      {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">ไม่พบรายการตามตัวกรอง</p>}
    </>
  );
}
