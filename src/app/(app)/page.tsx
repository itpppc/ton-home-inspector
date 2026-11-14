"use client";
import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Building2, ClipboardCheck, FileText } from "lucide-react";
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
import { ITEM_STATUS_COLORS, ProgressByCategoryChart, ShareBar, SimpleBarChart } from "@/components/app/charts";
import { cn, formatNumber } from "@/lib/utils";

type Scope = "property" | "all";

/** One cell of the ledger strip: label on top, mono figure, optional note. */
function Cell({ label, value, note, tone, testId }: { label: string; value: number | string; note?: string; tone?: string; testId?: string }) {
  return (
    <div className="bg-card px-3 py-3 sm:px-4" data-testid={testId}>
      <dt className="eyebrow !tracking-[0.06em] normal-case">{label}</dt>
      <dd data-value className={cn("figure mt-1 text-2xl font-semibold", tone)}>{value}</dd>
      {note && <dd className="text-[11px] text-muted-foreground">{note}</dd>}
    </div>
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

  if (ws.loading || !data) return <div className="h-40 animate-pulse rounded-md bg-muted" aria-busy />;
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
        title="ภาพรวมงานตรวจ"
        description={scope === "property" && ws.property ? `${ws.project?.name ?? ""} · แปลง ${ws.property.plot_number ?? "-"} · ${ws.property.house_model ?? ""}` : "ทุกโครงการและทุกบ้าน"}
        actions={<>
          <Button asChild variant="outline"><Link href="/reports"><FileText />รายงาน / Excel / สำรองข้อมูล</Link></Button>
          <div role="group" aria-label="ขอบเขตข้อมูล" className="inline-flex rounded-md border border-input bg-card p-0.5">
            {(["property", "all"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={cn("rounded-[4px] px-3 py-1.5 text-sm font-medium", scope === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {s === "property" ? "บ้านนี้" : "ทั้งหมด"}
              </button>
            ))}
          </div>
        </>}
      />

      {ws.property && <DeadlineBanner property={ws.property} className="mb-4" />}

      {/* Status sheet: the one number that matters, then the counts as a stamped tally */}
      <Card className="mb-4 overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div className="flex flex-col justify-between gap-3 border-b bg-foreground p-5 text-background md:border-b-0 md:border-r">
            <p className="font-mono text-[11px] font-semibold tracking-[0.14em] opacity-70">INSPECTION PROGRESS</p>
            <p className="figure text-6xl font-semibold leading-none">{cs.progressPct}<span className="text-3xl opacity-60">%</span></p>
            <p className="text-sm opacity-75" data-testid="checked-summary">ตรวจแล้ว <b className="figure">{formatNumber(cs.checked)}</b> / {formatNumber(cs.total)} ข้อ</p>
          </div>
          <div className="space-y-4 p-5">
            <Progress value={cs.progressPct} label="ความคืบหน้าการตรวจ" className="h-4" />
            <ul className="flex flex-wrap gap-2" aria-label="สรุปผลการตรวจ">
              {([["PASS", "ผ่าน", cs.counts.PASS], ["FAIL", "ไม่ผ่าน", cs.counts.FAIL], ["NEEDS_REINSPECTION", "ตรวจซ้ำ", cs.counts.NEEDS_REINSPECTION], ["NOT_APPLICABLE", "N/A", cs.counts.NOT_APPLICABLE]] as const).map(([k, label, n]) => (
                <li key={k} className="stamp" style={{ color: ITEM_STATUS_COLORS[k] }}>{label} <span className="figure">{n}</span></li>
              ))}
              <li className="stamp text-muted-foreground">รอตรวจ <span className="figure">{cs.pending}</span></li>
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">อัตราผ่าน <b className="figure text-foreground">{cs.passRatePct}%</b> · ข้อที่ยังไม่ตรวจไม่นับเป็นผ่าน</p>
              <Button asChild variant="accent" className="w-full sm:w-auto"><Link href="/inspect"><ClipboardCheck />ตรวจต่อ<ArrowRight /></Link></Button>
            </div>
          </div>
        </div>
      </Card>

      <section aria-label="ตัวชี้วัด" className="mb-4">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4 xl:grid-cols-8">
          <Cell label="โครงการ" value={ws.projects.length} />
          <Cell label="บ้าน" value={ws.properties.length} />
          <Cell label="ข้อตรวจ" value={formatNumber(cs.total)} />
          <Cell label="ผ่าน" value={cs.counts.PASS} tone="text-success" />
          <Cell label="ไม่ผ่าน" value={cs.counts.FAIL} tone="text-danger" />
          <Cell label="Defect วิกฤต" value={ds.criticalOpen} tone={ds.criticalOpen ? "text-danger" : undefined} note="ยังไม่ปิดงาน" />
          <Cell label="Defect ค้าง" value={ds.pending} tone={ds.pending ? "text-warning-strong" : undefined} />
          <Cell label="Defect ปิดแล้ว" value={ds.resolved} tone="text-success" testId="stat-resolved" />
        </dl>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader><p className="eyebrow">01 · หมวดงาน</p><CardTitle>ความคืบหน้าแยกตามหมวด</CardTitle></CardHeader>
          <CardContent>{catRows.size ? <ProgressByCategoryChart data={[...catRows.values()]} /> : <p className="text-sm text-muted-foreground">ยังไม่มี Checklist</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><p className="eyebrow">02 · ความรุนแรง</p><CardTitle>Defect ตามความรุนแรง</CardTitle></CardHeader>
          <CardContent>{ds.total ? <ShareBar data={SEVERITIES.map((s) => ({ name: SEVERITY_META[s].label, value: ds.bySeverity[s], color: SEVERITY_META[s].color }))} /> : <NoDefects />}</CardContent>
        </Card>
        <Card>
          <CardHeader><p className="eyebrow">03 · สถานะงานแก้</p><CardTitle>Defect ตามสถานะ</CardTitle></CardHeader>
          <CardContent>{ds.total ? <ShareBar data={DEFECT_STATUSES.map((s) => ({ name: DEFECT_STATUS_META[s].label, value: ds.byStatus[s], color: DEFECT_STATUS_META[s].color }))} /> : <NoDefects />}</CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><p className="eyebrow">04 · จุดที่พบมาก</p><CardTitle>Defect แยกตามหมวด</CardTitle></CardHeader>
          <CardContent>{ds.total ? <SimpleBarChart data={defectsByCategory(data.defects)} /> : <NoDefects />}</CardContent>
        </Card>
      </div>
    </>
  );
}

function NoDefects() {
  return <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มี Defect ที่บันทึก</p>;
}
