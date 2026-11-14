"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Building2, ChevronRight, FolderKanban, MapPin, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { createPilotHouse, createProject } from "@/lib/db/repo";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/providers/auth-provider";
import { checklistStats } from "@/lib/domain/stats";
import { CONSTRUCTION_STATUS_META } from "@/lib/domain/labels";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { ProjectForm } from "@/features/projects/project-form";
import { formatDate } from "@/lib/utils";
import { usePlan } from "@/features/plans/use-plan";
import { UpgradeDialog } from "@/features/plans/plan-ui";

export default function ProjectsPage() {
  const ws = useWorkspace();
  const auth = useAuth();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [limitOpen, setLimitOpen] = React.useState(false);
  const plan = usePlan();
  const quota = plan.quota("projects");
  const startCreate = () => (quota.allowed ? setOpen(true) : setLimitOpen(true));
  const progress = useLiveQuery(async () => {
    const items = await getDB().checklist_items.filter(alive).toArray();
    const map = new Map<string, number>();
    for (const p of ws.properties) map.set(p.id, checklistStats(items.filter((i) => i.property_id === p.id)).progressPct);
    return map;
  }, [ws.properties]);

  return (
    <>
      <PageHeader
        title="โครงการ & บ้าน"
        description="จัดการโครงการ บ้านแต่ละหลัง วันโอน และสิทธิ์แจ้งเก็บงาน"
        actions={auth.canCreateProject && <Button onClick={startCreate}><Plus />สร้างโครงการ</Button>}
      />
      {ws.loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : ws.projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="ยังไม่มีโครงการ" body="สร้างโครงการแรกเพื่อเริ่มเพิ่มบ้านและ Checklist" action={auth.canCreateProject && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={startCreate}><Plus />สร้างโครงการ</Button>
            {auth.isSystemAdmin && (
              <Button variant="accent" onClick={async () => {
                const { property } = await createPilotHouse(auth.userId);
                toast.success("สร้างบ้าน TH99B พร้อม Checklist แล้ว");
                router.push(`/property?id=${property.id}`);
              }}><Sparkles />เริ่มบ้าน Siri Place Rama 2 · TH99B</Button>
            )}
          </div>
        )} />
      ) : (
        <div className="space-y-4">
          {ws.projects.map((pj) => {
            const props = ws.properties.filter((p) => p.project_id === pj.id);
            return (
              <Card key={pj.id} className="overflow-hidden">
                <Link href={`/project?id=${pj.id}`} className="flex items-center gap-3 border-b p-4 hover:bg-muted/50">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><FolderKanban className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{pj.name}</p>
                    <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">{pj.developer ?? "ไม่ระบุผู้พัฒนา"}{pj.location && <><MapPin className="ml-1 size-3.5" />{pj.location}</>}</p>
                  </div>
                  <Badge tone="primary">{props.length} หลัง</Badge>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
                {props.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">ยังไม่มีบ้านในโครงการนี้</p>
                ) : (
                  <ul className="divide-y">
                    {props.map((p) => (
                      <li key={p.id}>
                        <Link href={`/property?id=${p.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                          <Building2 className="size-5 shrink-0 text-secondary-strong" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">แปลง {p.plot_number ?? "-"} · {p.house_model ?? "-"} · {CONSTRUCTION_STATUS_META[p.construction_status]} · โอนจริง {formatDate(p.transfer_date_actual)}</p>
                            <Progress value={progress?.get(p.id) ?? 0} className="mt-2 h-1.5" label={`ความคืบหน้า ${p.name}`} />
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{progress?.get(p.id) ?? 0}%</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <UpgradeDialog open={limitOpen} onOpenChange={setLimitOpen} kind="projects" quota={quota} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="สร้างโครงการใหม่" description="หลังสร้างแล้วจึงเพิ่มบ้านในโครงการ">
          <ProjectForm
            submitLabel="สร้างโครงการ"
            onSubmit={async (v) => {
              const p = await createProject(v, auth.userId);
              toast.success("สร้างโครงการแล้ว");
              setOpen(false);
              router.push(`/project?id=${p.id}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
