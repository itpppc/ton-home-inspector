"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ClipboardCheck, House, ListChecks, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { applyTemplate, deleteProperty, updateProperty } from "@/lib/db/repo";
import { PhotoCapture } from "@/features/photos/photo-capture";
import { PhotoGallery, usePhotos } from "@/features/photos/photo-gallery";
import { selectProperty } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { checklistStats } from "@/lib/domain/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DeadlineBanner } from "@/components/app/deadline-banner";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { PropertyForm } from "@/features/properties/property-form";
import { useIdParam } from "@/components/app/use-id-param";

function PropertyDetail() {
  const id = useIdParam();
  const router = useRouter();
  const auth = useAuth();
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const db = getDB();
    const property = await db.properties.get(id);
    if (!property || !alive(property)) return null;
    const [project, items] = await Promise.all([db.projects.get(property.project_id), db.checklist_items.where("property_id").equals(id).filter(alive).toArray()]);
    return { property, project, stats: checklistStats(items) };
  }, [id]);

  React.useEffect(() => {
    if (data?.property) void selectProperty(data.property.id);
  }, [data?.property]);

  if (data === undefined) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (data === null) return <EmptyState icon={House} title="ไม่พบบ้านหลังนี้" action={<Button asChild variant="outline"><Link href="/projects">กลับ</Link></Button>} />;
  const { property, project, stats } = data;
  const canEdit = auth.canEdit(property.project_id, project?.owner_id);
  const isAdmin = auth.isAdmin(property.project_id, project?.owner_id);

  return (
    <>
      <Link href={`/project?id=${property.project_id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{project?.name ?? "โครงการ"}</Link>
      <PageHeader title={property.name} description={`แปลง ${property.plot_number ?? "-"} · แบบ ${property.house_model ?? "-"}`}
        actions={isAdmin && (
          <Button variant="outline" className="text-danger" onClick={async () => {
            if (!window.confirm(`ลบ "${property.name}" และ Checklist ทั้งหมด?`)) return;
            await deleteProperty(property.id);
            toast.success("ลบบ้านแล้ว");
            router.replace(`/project?id=${property.project_id}`);
          }}><Trash2 />ลบบ้าน</Button>
        )}
      />
      <DeadlineBanner property={property} className="mb-4" />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>ข้อมูลบ้าน (Property)</CardTitle></CardHeader>
          <CardContent>
            <PropertyForm key={property.updated_at} initial={property} disabled={!canEdit}
              onSubmit={async (v) => { await updateProperty(property.id, v); toast.success("บันทึกข้อมูลบ้านแล้ว"); }} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Checklist</CardTitle>
            <CardDescription>{stats.total} รายการ · ตรวจแล้ว {stats.checked}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={stats.progressPct} label="ความคืบหน้า" />
            <p className="text-sm">ความคืบหน้า <b>{stats.progressPct}%</b> · ผ่าน {stats.counts.PASS} · ไม่ผ่าน {stats.counts.FAIL}</p>
            {stats.total === 0 && canEdit && (
              <Button variant="accent" className="w-full" onClick={async () => {
                const r = await applyTemplate(property.project_id, property.id);
                toast.success(`สร้าง Checklist ${r.items} รายการ`);
              }}><Sparkles />สร้าง Checklist มาตรฐาน</Button>
            )}
            <Button asChild className="w-full"><Link href="/inspect"><ClipboardCheck />เริ่มตรวจบ้าน</Link></Button>
            <Button asChild variant="outline" className="w-full"><Link href="/checklist"><ListChecks />จัดการหัวข้อ Checklist</Link></Button>
          </CardContent>
        </Card>
      </div>
      <HousePhotos projectId={property.project_id} propertyId={property.id} canEdit={canEdit} />
    </>
  );
}

/** Front of house, floor plans and documents — shown on the report cover. */
function HousePhotos({ projectId, propertyId, canEdit }: { projectId: string; propertyId: string; canEdit: boolean }) {
  const photos = usePhotos({ propertyId });
  return (
    <Card className="mt-4">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>รูปบ้าน & ผังบ้าน</CardTitle>
          <CardDescription>รูปหน้าบ้าน ผังชั้น 1–2 หรือเอกสารจากโครงการ · แสดงในหน้าแรกของรายงาน</CardDescription>
        </div>
        {canEdit && <PhotoCapture target={{ project_id: projectId, property_id: propertyId }} kind="PROPERTY" size="sm" label="ถ่าย/แนบรูป" />}
      </CardHeader>
      <CardContent>
        <PhotoGallery photos={photos} canDelete={canEdit} emptyText="ยังไม่มีรูป กดปุ่มรูปภาพเพื่อเลือกผังบ้านจากคลังภาพได้หลายรูปพร้อมกัน" />
      </CardContent>
    </Card>
  );
}

export default function PropertyPage() {
  return <React.Suspense><PropertyDetail /></React.Suspense>;
}
