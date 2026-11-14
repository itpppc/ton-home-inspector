"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Building2, ChevronRight, FolderX, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { createProperty, deleteProject, updateProject } from "@/lib/db/repo";
import { selectProperty } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { CONSTRUCTION_STATUS_META } from "@/lib/domain/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { ProjectForm } from "@/features/projects/project-form";
import { PropertyForm } from "@/features/properties/property-form";
import { MembersPanel } from "@/features/projects/members-panel";
import { useIdParam } from "@/components/app/use-id-param";
import { formatDate } from "@/lib/utils";

function ProjectDetail() {
  const id = useIdParam();
  const router = useRouter();
  const auth = useAuth();
  const [addOpen, setAddOpen] = React.useState(false);
  const [withTemplate, setWithTemplate] = React.useState(true);
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const db = getDB();
    const project = await db.projects.get(id);
    if (!project || !alive(project)) return null;
    const properties = (await db.properties.where("project_id").equals(id).filter(alive).toArray()).sort((a, b) => a.name.localeCompare(b.name, "th"));
    return { project, properties };
  }, [id]);

  if (data === undefined) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (data === null) return <EmptyState icon={FolderX} title="ไม่พบโครงการ" action={<Button asChild variant="outline"><Link href="/projects">กลับ</Link></Button>} />;
  const { project, properties } = data;
  const canEdit = auth.canEdit(project.id, project.owner_id);
  const isAdmin = auth.isAdmin(project.id, project.owner_id);

  return (
    <>
      <Link href="/projects" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />โครงการทั้งหมด</Link>
      <PageHeader title={project.name} description={project.developer ?? undefined}
        actions={isAdmin && (
          <Button variant="outline" className="text-danger" onClick={async () => {
            if (!window.confirm(`ลบโครงการ "${project.name}" และบ้าน/Checklist ทั้งหมดในโครงการ?`)) return;
            await deleteProject(project.id);
            toast.success("ลบโครงการแล้ว");
            router.replace("/projects");
          }}><Trash2 />ลบโครงการ</Button>
        )}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader><CardTitle>ข้อมูลโครงการ</CardTitle></CardHeader>
          <CardContent>
            <ProjectForm key={project.updated_at} initial={project} disabled={!canEdit}
              onSubmit={async (v) => { await updateProject(project.id, v); toast.success("บันทึกแล้ว"); }} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>บ้านในโครงการ ({properties.length})</CardTitle>
              {canEdit && <Button size="sm" onClick={() => setAddOpen(true)}><Plus />เพิ่มบ้าน</Button>}
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มีบ้าน</p> : (
                <ul className="divide-y rounded-lg border">
                  {properties.map((p) => (
                    <li key={p.id}>
                      <Link href={`/property?id=${p.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                        <Building2 className="size-5 text-secondary-strong" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.house_model ?? "-"} · {CONSTRUCTION_STATUS_META[p.construction_status]} · โอน {formatDate(p.transfer_date_actual)}</p>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <MembersPanel projectId={project.id} />
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title="เพิ่มบ้าน" description={project.name} className="sm:max-w-2xl">
          <PropertyForm submitLabel="เพิ่มบ้าน"
            extra={
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--color-primary)]" checked={withTemplate} onChange={(e) => setWithTemplate(e.target.checked)} />
                <span><b>สร้าง Checklist มาตรฐาน</b> (~180 รายการ ทาวน์โฮม 2 ชั้น) แก้ไขภายหลังได้</span>
              </label>
            }
            onSubmit={async (v) => {
              const p = await createProperty(project.id, v, { withTemplate });
              await selectProperty(p.id);
              toast.success("เพิ่มบ้านแล้ว");
              setAddOpen(false);
              router.push(`/property?id=${p.id}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ProjectPage() {
  return <React.Suspense><ProjectDetail /></React.Suspense>;
}
