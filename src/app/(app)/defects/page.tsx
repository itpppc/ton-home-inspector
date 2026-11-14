"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bug, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { createDefect } from "@/lib/db/defects";
import { defectStats } from "@/lib/domain/stats";
import { SEVERITIES, type Defect, type Severity } from "@/lib/domain/types";
import { SEVERITY_META } from "@/lib/domain/labels";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DeadlineBanner } from "@/components/app/deadline-banner";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { DefectCard } from "@/features/defects/defect-card";
import { DefectForm } from "@/features/defects/defect-form";
import { useDefects } from "@/features/defects/use-defects";

const TABS = [
  { id: "all", label: "ทั้งหมด", match: () => true },
  { id: "open", label: "ต้องแก้ไข", match: (d: Defect) => ["OPEN", "SUBMITTED", "IN_PROGRESS", "REOPENED"].includes(d.status) },
  { id: "reinspect", label: "รอตรวจซ้ำ", match: (d: Defect) => d.status === "FIXED" },
  { id: "closed", label: "ปิดงานแล้ว", match: (d: Defect) => d.status === "VERIFIED" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function DefectsPage() {
  const ws = useWorkspace();
  const auth = useAuth();
  const router = useRouter();
  const data = useDefects(ws.property?.id);
  const [tab, setTab] = React.useState<TabId>("all");
  const [severity, setSeverity] = React.useState<"all" | Severity>("all");
  const [room, setRoom] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const q = React.useDeferredValue(query.trim().toLowerCase());

  if (ws.loading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  const property = ws.property;
  if (!property) return <EmptyState icon={Bug} title="ยังไม่ได้เลือกบ้าน" action={<Button asChild><Link href="/projects">ไปที่โครงการ</Link></Button>} />;
  const canEdit = auth.canEdit(property.project_id, ws.project?.owner_id);
  const stats = defectStats(data.defects);
  const count = (id: TabId) => data.defects.filter(TABS.find((t) => t.id === id)!.match).length;
  const active = TABS.find((t) => t.id === tab)!;
  const shown = data.defects.filter((d) =>
    active.match(d) &&
    (severity === "all" || d.severity === severity) &&
    (room === "all" || (room === "none" ? !d.room_id : d.room_id === room)) &&
    (!q || `${d.code} ${d.title} ${d.description ?? ""} ${d.location ?? ""} ${d.category ?? ""}`.toLowerCase().includes(q)),
  );

  return (
    <>
      <PageHeader title="Defect" description={`${property.name} · ทั้งหมด ${stats.total} · แก้แล้ว ${stats.resolved} · ค้าง ${stats.pending}`}
        actions={canEdit && <Button onClick={() => setCreating(true)}><Plus />บันทึก Defect</Button>} />
      <DeadlineBanner property={property} className="mb-3" />
      {stats.criticalOpen > 0 && <p role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">มี Defect ระดับวิกฤตที่ยังไม่ปิด {stats.criticalOpen} รายการ — ไม่ควรรับโอนจนกว่าจะแก้และตรวจซ้ำผ่าน</p>}

      <div className="mb-3 space-y-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <TabsList className="w-full overflow-x-auto sm:w-auto">
            {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label} ({count(t.id)})</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Select aria-label="ระดับความรุนแรง" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
            <option value="all">ทุกระดับ</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label} ({stats.bySeverity[s]})</option>)}
          </Select>
          <Select aria-label="ห้อง" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="all">ทุกห้อง</option>
            <option value="none">ไม่ระบุห้อง</option>
            {data.rooms.map((r) => <option key={r.id} value={r.id}>{r.floor ? `${r.floor} - ${r.name}` : r.name}</option>)}
          </Select>
          <div className="relative col-span-2 md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="ค้นหา Defect" placeholder="ค้นหา…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">แสดง {shown.length} จาก {data.defects.length} รายการ</p>
      {data.defects.length === 0 ? (
        <EmptyState icon={Bug} title="ยังไม่พบ Defect" body="เมื่อตรวจแล้วกด “ไม่ผ่าน” ที่หัวข้อตรวจ หรือบันทึก Defect เองได้จากปุ่มด้านบน" />
      ) : (
        <div className="space-y-2">
          {shown.map((d) => <DefectCard key={d.id} defect={d} photos={data.photoCount.get(d.id) ?? 0} />)}
          {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">ไม่พบรายการตามตัวกรอง</p>}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        {creating && (
          <DialogContent title="บันทึก Defect" description="หลังบันทึกจะไปหน้ารายละเอียดเพื่อถ่ายรูปหลักฐาน" className="sm:max-w-2xl">
            <DefectForm rooms={data.rooms} categories={data.categories} onSubmit={async (v) => {
              try {
                const d = await createDefect({ property, values: v, actor: auth.userId });
                toast.success(`บันทึก ${d.code} แล้ว`);
                setCreating(false);
                router.push(`/defect?id=${d.id}`);
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
