"use client";
import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowUp, Copy, DoorOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { copyRoomItems, createRoom, deleteRoom, move, updateRoom } from "@/lib/db/repo";
import { roomLabel } from "@/lib/seed/checklist-template";
import type { Room } from "@/lib/domain/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { RoomForm } from "@/features/rooms/room-form";

type Editing = { mode: "create" } | { mode: "edit"; room: Room } | { mode: "copy"; room: Room } | null;

export default function RoomsPage() {
  const ws = useWorkspace();
  const auth = useAuth();
  const propertyId = ws.property?.id;
  const data = useLiveQuery(async () => {
    if (!propertyId) return null;
    const db = getDB();
    const [rooms, items, defects] = await Promise.all([
      db.rooms.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.checklist_items.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.defects.where("property_id").equals(propertyId).filter(alive).toArray(),
    ]);
    rooms.sort((a, b) => a.sort_order - b.sort_order);
    const itemCount = new Map<string, number>();
    const defectCount = new Map<string, number>();
    for (const i of items) if (i.room_id) itemCount.set(i.room_id, (itemCount.get(i.room_id) ?? 0) + 1);
    for (const d of defects) if (d.room_id) defectCount.set(d.room_id, (defectCount.get(d.room_id) ?? 0) + 1);
    return { rooms, itemCount, defectCount };
  }, [propertyId]);
  const [editing, setEditing] = React.useState<Editing>(null);
  const [copyTarget, setCopyTarget] = React.useState("");

  if (ws.loading || data === undefined) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  const property = ws.property;
  if (!property || !data) return <EmptyState icon={DoorOpen} title="ยังไม่ได้เลือกบ้าน" action={<Button asChild><Link href="/projects">ไปที่โครงการ</Link></Button>} />;
  const canEdit = auth.canEdit(property.project_id, ws.project?.owner_id);
  const floors = [...new Set(data.rooms.map((r) => r.floor).filter((f): f is string => !!f))];

  const guard = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return false;
    }
  };

  return (
    <>
      <PageHeader title="ห้อง / ตำแหน่ง" description={`${property.name} · ${data.rooms.length} ห้อง`}
        actions={canEdit && <Button onClick={() => setEditing({ mode: "create" })}><Plus />เพิ่มห้อง</Button>} />
      {!canEdit && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">คุณมีสิทธิ์ดูอย่างเดียว</p>}
      {data.rooms.length === 0 ? (
        <EmptyState icon={DoorOpen} title="ยังไม่มีห้อง" body="เพิ่มห้องเพื่อผูกหัวข้อตรวจและ Defect เข้ากับตำแหน่ง" />
      ) : (
        <Card>
          <ul className="divide-y">
            {data.rooms.map((r, i) => {
              const items = data.itemCount.get(r.id) ?? 0;
              const defects = data.defectCount.get(r.id) ?? 0;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 p-3" data-testid="room-row">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{roomLabel(r)}</p>
                    <p className="text-xs text-muted-foreground">{items} หัวข้อตรวจ · {defects} Defect</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-0.5">
                      <Button size="icon-sm" variant="ghost" aria-label={`เลื่อน ${roomLabel(r)} ขึ้น`} disabled={i === 0} onClick={() => void move("rooms", r.id, -1)}><ArrowUp /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`เลื่อน ${roomLabel(r)} ลง`} disabled={i === data.rooms.length - 1} onClick={() => void move("rooms", r.id, 1)}><ArrowDown /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`คัดลอกหัวข้อตรวจของ ${roomLabel(r)}`} disabled={items === 0 || data.rooms.length < 2} onClick={() => { setCopyTarget(""); setEditing({ mode: "copy", room: r }); }}><Copy /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`แก้ไข ${roomLabel(r)}`} onClick={() => setEditing({ mode: "edit", room: r })}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" className="text-danger" aria-label={`ลบ ${roomLabel(r)}`}
                        onClick={() => window.confirm(`ลบ "${roomLabel(r)}"?\n• หัวข้อตรวจ ${items} รายการในห้องนี้จะถูกลบ\n• Defect ${defects} รายการจะถูกเก็บไว้ (ไม่ระบุห้อง)`) && void guard(() => deleteRoom(r.id), "ลบห้องแล้ว")}><Trash2 /></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && editing.mode !== "copy" && (
          <DialogContent title={editing.mode === "create" ? "เพิ่มห้อง" : "แก้ไขห้อง"} description={editing.mode === "edit" ? "การเปลี่ยนชื่อจะอัปเดตตำแหน่งในหัวข้อตรวจและ Defect ของห้องนี้ด้วย" : undefined}>
            <RoomForm initial={editing.mode === "edit" ? editing.room : undefined} floors={floors} onSubmit={async (v) => {
              const ok = await guard(() => (editing.mode === "create" ? createRoom(property, v) : updateRoom(editing.room.id, v)), "บันทึกแล้ว");
              if (ok) setEditing(null);
            }} />
          </DialogContent>
        )}
        {editing?.mode === "copy" && (
          <DialogContent title="คัดลอกหัวข้อตรวจไปห้องอื่น" description={`จาก ${roomLabel(editing.room)} (สถานะเริ่มใหม่ รหัสใหม่อัตโนมัติ)`}>
            <div className="grid gap-4">
              <Select aria-label="ห้องปลายทาง" value={copyTarget} onChange={(e) => setCopyTarget(e.target.value)}>
                <option value="">เลือกห้องปลายทาง…</option>
                {data.rooms.filter((r) => r.id !== editing.room.id).map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
              </Select>
              <Button disabled={!copyTarget} onClick={async () => {
                let n = 0;
                const ok = await guard(async () => { n = await copyRoomItems(editing.room.id, copyTarget); });
                if (ok) { toast.success(`คัดลอก ${n} หัวข้อแล้ว`); setEditing(null); }
              }}>คัดลอก</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
