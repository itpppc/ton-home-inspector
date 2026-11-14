"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, FolderPlus, ListChecks, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { useChecklist } from "@/features/checklist/use-checklist";
import { ItemForm } from "@/features/checklist/item-form";
import { applyTemplate, copyChecklist, createCategory, createItem, deleteCategory, deleteItem, move, renameCategory, updateItem } from "@/lib/db/repo";
import type { ChecklistItem } from "@/lib/domain/types";
import { ITEM_STATUS_META, PRIORITY_META } from "@/lib/domain/labels";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/app/app-shell";

type Editing = { mode: "create"; categoryId: string } | { mode: "edit"; item: ChecklistItem } | null;

export default function ChecklistManagePage() {
  const ws = useWorkspace();
  const auth = useAuth();
  const data = useChecklist(ws.property?.id);
  const [editing, setEditing] = React.useState<Editing>(null);
  const [newCat, setNewCat] = React.useState("");
  const [copyFrom, setCopyFrom] = React.useState("");

  if (ws.loading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  const property = ws.property;
  if (!property) return <EmptyState icon={ListChecks} title="ยังไม่ได้เลือกบ้าน" action={<Button asChild><Link href="/projects">ไปที่โครงการ</Link></Button>} />;
  const canEdit = auth.canEdit(property.project_id, ws.project?.owner_id);
  const others = ws.properties.filter((p) => p.id !== property.id);

  const guard = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  };

  return (
    <>
      <PageHeader title="จัดการ Checklist" description={`${property.name} · ${data.categories.length} หมวด · ${data.items.length} หัวข้อ`} />
      {!canEdit && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">คุณมีสิทธิ์ดูอย่างเดียว</p>}

      {canEdit && (
        <Card className="mb-4 flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <form className="flex flex-1 gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            void guard(() => createCategory(property, newCat), "เพิ่มหมวดแล้ว").then(() => setNewCat(""));
          }}>
            <Input aria-label="ชื่อหมวดใหม่" placeholder="ชื่อหมวดใหม่ เช่น งานระบบสระว่ายน้ำ" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={120} />
            <Button type="submit" variant="secondary"><FolderPlus />เพิ่มหมวด</Button>
          </form>
          {data.items.length === 0 && (
            <Button variant="accent" onClick={() => void guard(async () => { const r = await applyTemplate(property.project_id, property.id); toast.success(`สร้าง ${r.items} รายการ`); })}><Sparkles />ใช้ Checklist มาตรฐาน</Button>
          )}
          {others.length > 0 && (
            <div className="flex gap-2">
              <Select aria-label="คัดลอกจากบ้าน" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="lg:w-56">
                <option value="">คัดลอก Checklist จาก…</option>
                {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <Button variant="outline" disabled={!copyFrom} onClick={() => window.confirm("คัดลอกหมวดและหัวข้อทั้งหมด (สถานะเริ่มใหม่) มาเพิ่มในบ้านนี้?") && void guard(() => copyChecklist(copyFrom, property), "คัดลอกแล้ว").then(() => setCopyFrom(""))}><Copy />คัดลอก</Button>
            </div>
          )}
        </Card>
      )}

      {data.categories.length === 0 ? (
        <EmptyState icon={ListChecks} title="ยังไม่มีหมวด Checklist" body="เพิ่มหมวดเอง หรือใช้ Checklist มาตรฐาน" />
      ) : (
        <div className="space-y-4">
          {data.categories.map((cat, ci) => {
            const items = data.byCategory.get(cat.id) ?? [];
            return (
              <Card key={cat.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 p-3">
                  <h2 className="flex-1 font-semibold">{cat.name} <span className="text-sm font-normal text-muted-foreground">({items.length})</span></h2>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label="เลื่อนหมวดขึ้น" disabled={ci === 0} onClick={() => void move("checklist_categories", cat.id, -1)}><ArrowUp /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="เลื่อนหมวดลง" disabled={ci === data.categories.length - 1} onClick={() => void move("checklist_categories", cat.id, 1)}><ArrowDown /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="เปลี่ยนชื่อหมวด" onClick={() => {
                        const name = window.prompt("ชื่อหมวด", cat.name)?.trim();
                        if (name && name !== cat.name) void guard(() => renameCategory(cat.id, name.slice(0, 120)), "เปลี่ยนชื่อแล้ว");
                      }}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" className="text-danger" aria-label="ลบหมวด" onClick={() => window.confirm(`ลบหมวด "${cat.name}" และ ${items.length} หัวข้อ?`) && void guard(() => deleteCategory(cat.id), "ลบหมวดแล้ว")}><Trash2 /></Button>
                      <Button size="sm" onClick={() => setEditing({ mode: "create", categoryId: cat.id })}><Plus />หัวข้อ</Button>
                    </div>
                  )}
                </div>
                <ul className="divide-y">
                  {items.map((it, ii) => (
                    <li key={it.id} className="flex items-start gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] text-muted-foreground">{it.code}</span>
                          <Badge tone={PRIORITY_META[it.priority].tone}>{PRIORITY_META[it.priority].label}</Badge>
                          {it.status !== "NOT_CHECKED" && <Badge tone={ITEM_STATUS_META[it.status].tone}>{ITEM_STATUS_META[it.status].short}</Badge>}
                        </div>
                        <p className="text-sm font-medium">{it.title}</p>
                        {it.location && <p className="text-xs text-muted-foreground">{it.location}</p>}
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-0.5">
                          <Button size="icon-sm" variant="ghost" aria-label="เลื่อนขึ้น" disabled={ii === 0} onClick={() => void move("checklist_items", it.id, -1)}><ArrowUp /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="เลื่อนลง" disabled={ii === items.length - 1} onClick={() => void move("checklist_items", it.id, 1)}><ArrowDown /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="แก้ไข" onClick={() => setEditing({ mode: "edit", item: it })}><Pencil /></Button>
                          <Button size="icon-sm" variant="ghost" className="text-danger" aria-label="ลบ" onClick={() => window.confirm(`ลบ "${it.title}"?`) && void guard(() => deleteItem(it.id), "ลบแล้ว")}><Trash2 /></Button>
                        </div>
                      )}
                    </li>
                  ))}
                  {items.length === 0 && <li className="p-3 text-sm text-muted-foreground">ยังไม่มีหัวข้อ</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent title={editing.mode === "create" ? "เพิ่มหัวข้อตรวจ" : "แก้ไขหัวข้อตรวจ"} className="sm:max-w-2xl">
            <ItemForm
              categories={data.categories}
              locations={data.locations}
              initial={editing.mode === "edit" ? editing.item : undefined}
              defaultCategoryId={editing.mode === "create" ? editing.categoryId : undefined}
              onSubmit={async (v) => {
                await guard(() => (editing.mode === "create" ? createItem(property, v) : updateItem(editing.item.id, v)), "บันทึกแล้ว");
                setEditing(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
