"use client";
import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertOctagon, Building2, CheckCircle2, ClipboardCheck, ClipboardList, FolderKanban, Hourglass, ShieldCheck, Wrench, XCircle } from "lucide-react";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { useWorkspace } from "@/hooks/use-workspace";
import { categoryProgress, checklistStats, defectStats, defectsByCategory } from "@/lib/domain/stats";
import { DEFECT_STATUS_META, SEVERITY_META } from "@/lib/domain/labels";
import { DEFECT_STATUSES, SEVERITIES } from "@/lib/domain/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DeadlineBanner } from "@/components/app/deadline-banner";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { DonutChart, ProgressByCategoryChart, SimpleBarChart } from "@/components/app/charts";
import { cn, formatNumber } from "@/lib/utils";

type Scope = "property" | "all";

function Stat({ label, value, icon: Icon, tone, hint }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={cn("grid size-10 place-items-center rounded-lg", tone)}><Icon className="size-5" /></span>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const ws = useWorkspace();
  const [scope, setScope] = React.useState<Scope>("property");
  const propertyId = ws.property?.id;

  const data = useLiveQuery(async () => {
    const db = getDB();
    const liveProps = new Set(ws.properties.map((p) => p.id));
    const inScope = <T extends { property_id: string; deleted_at: string | null }>(r: T) => alive(r) && (scope === "all" ? liveProps.has(r.property_id) : r.property_id === propertyId);
    const [items, categories, defects] = await Promise.all([
      db.checklist_items.filter(inScope).toArray(),
      db.checklist_categories.filter(inScope).toArray(),
      db.defects.filter(inScope).toArray(),
    ]);
    return { items, categories, defects };
  }, [scope, propertyId, ws.properties]);

  if (ws.loading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy />;
  if (ws.properties.length === 0) {
    return <EmptyState icon={Building2} title="ยังไม่มีบ้านในระบบ" body="เริ่มจากสร้างโครงการและเพิ่มบ้านที่จะตรวจ" action={<Button asChild><Link href="/projects">ไปที่โครงการ</Link></Button>} />;
  }

  const cs = checklistStats(data.items);
  const ds = defectStats(data.defects);
  // Category names may repeat across properties when scope=all: merge by name.
  const catRows = new Map<string, { name: string; PASS: number; FAIL: number; NEEDS_REINSPECTION: number; NOT_APPLICABLE: number; NOT_CHECKED: number }>();
  for (const c of categoryProgress(data.categories, data.items)) {
    const row = catRows.get(c.name) ?? { name: c.name, PASS: 0, FAIL: 0, NEEDS_REINSPECTION: 0, NOT_APPLICABLE: 0, NOT_CHECKED: 0 };
    for (const k of ["PASS", "FAIL", "NEEDS_REINSPECTION", "NOT_APPLICABLE", "NOT_CHECKED"] as const) row[k] += c.counts[k];
    catRows.set(c.name, row);
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={scope === "property" && ws.property ? `${ws.project?.name ?? ""} · แปลง ${ws.property.plot_number ?? "-"} · ${ws.property.house_model ?? ""}` : "ทุกโครงการและทุกบ้าน"}
        actions={
          <div role="group" aria-label="ขอบเขตข้อมูล" className="inline-flex rounded-lg bg-muted p-1">
            {(["property", "all"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", scope === s ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {s === "property" ? "บ้านนี้" : "ทั้งหมด"}
              </button>
            ))}
          </div>
        }
      />

      {ws.property && <DeadlineBanner property={ws.property} className="mb-4" />}

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle>Inspection Progress</CardTitle>
              <CardDescription>ตรวจแล้ว {formatNumber(cs.checked)} จาก {formatNumber(cs.total)} รายการ · ไม่นับรายการที่ยังไม่ตรวจเป็นผ่าน</CardDescription>
            </div>
            <p className="text-3xl font-bold tabular-nums text-primary dark:text-secondary">{cs.progressPct}%</p>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={cs.progressPct} label="ความคืบหน้าการตรวจ" className="h-3" />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span><b className="text-success">{cs.counts.PASS}</b> ผ่าน</span>
            <span><b className="text-danger">{cs.counts.FAIL}</b> ไม่ผ่าน</span>
            <span><b className="text-warning-strong">{cs.counts.NEEDS_REINSPECTION}</b> ต้องตรวจซ้ำ</span>
            <span><b className="text-secondary-strong">{cs.counts.NOT_APPLICABLE}</b> N/A</span>
            <span><b>{cs.pending}</b> รอตรวจ</span>
            <span className="text-muted-foreground">อัตราผ่าน {cs.passRatePct}%</span>
          </div>
          <Button asChild className="mt-4 w-full sm:w-auto"><Link href="/inspect"><ClipboardCheck />ตรวจต่อ</Link></Button>
        </CardContent>
      </Card>

      <section aria-label="ตัวชี้วัด" className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total Projects" value={ws.projects.length} icon={FolderKanban} tone="bg-primary/10 text-primary dark:text-secondary" />
        <Stat label="Total Properties" value={ws.properties.length} icon={Building2} tone="bg-primary/10 text-primary dark:text-secondary" />
        <Stat label="Inspection Items" value={formatNumber(cs.total)} icon={ClipboardList} tone="bg-accent/12 text-accent" />
        <Stat label="Passed" value={cs.counts.PASS} icon={CheckCircle2} tone="bg-success/12 text-success" />
        <Stat label="Failed" value={cs.counts.FAIL} icon={XCircle} tone="bg-danger/12 text-danger" />
        <Stat label="Pending Inspection" value={cs.pending} icon={Hourglass} tone="bg-muted text-muted-foreground" />
        <Stat label="Critical Defects" value={ds.criticalOpen} icon={AlertOctagon} tone="bg-danger/12 text-danger" hint="ยังไม่ปิดงาน" />
        <Stat label="Resolved Defects" value={ds.resolved} icon={ShieldCheck} tone="bg-success/12 text-success" />
        <Stat label="Pending Defects" value={ds.pending} icon={Wrench} tone="bg-warning/15 text-warning-strong" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Inspection Progress by Category</CardTitle></CardHeader>
          <CardContent>{catRows.size ? <ProgressByCategoryChart data={[...catRows.values()]} /> : <p className="text-sm text-muted-foreground">ยังไม่มี Checklist</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Defect Severity</CardTitle></CardHeader>
          <CardContent>{ds.total ? <DonutChart data={SEVERITIES.map((s) => ({ name: SEVERITY_META[s].label, value: ds.bySeverity[s], color: SEVERITY_META[s].color }))} /> : <NoDefects />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Defect Status</CardTitle></CardHeader>
          <CardContent>{ds.total ? <DonutChart data={DEFECT_STATUSES.map((s) => ({ name: DEFECT_STATUS_META[s].label, value: ds.byStatus[s], color: DEFECT_STATUS_META[s].color }))} /> : <NoDefects />}</CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Defect by Category</CardTitle></CardHeader>
          <CardContent>{ds.total ? <SimpleBarChart data={defectsByCategory(data.defects)} /> : <NoDefects />}</CardContent>
        </Card>
      </div>
    </>
  );
}

function NoDefects() {
  return <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มี Defect ที่บันทึก</p>;
}
