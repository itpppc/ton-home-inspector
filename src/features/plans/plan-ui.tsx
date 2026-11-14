"use client";
import Link from "next/link";
import { Check, Crown, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TON_AI } from "@/lib/brand/ton-ai";
import { cn } from "@/lib/utils";
import { formatLimit, formatPrice, QUOTA_LABEL, type PlanRow, type PlanTier, type Quota, type QuotaKind } from "./plans";

export const PLAN_TONE: Record<PlanTier, "neutral" | "primary" | "accent"> = { FREE: "neutral", PRO: "primary", BUSINESS: "accent" };

export function PlanBadge({ tier, className }: { tier: PlanTier; className?: string }) {
  return <Badge tone={PLAN_TONE[tier]} className={className}>{tier !== "FREE" && <Crown className="size-3" aria-hidden />}{tier}</Badge>;
}

export function UsageMeter({ kind, quota }: { kind: QuotaKind; quota: Quota }) {
  const { noun, unit } = QUOTA_LABEL[kind];
  const pct = quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span>{noun}</span>
        <span className={cn("tabular-nums font-medium", !quota.allowed && "text-danger")}>
          {quota.used.toLocaleString("th-TH")} / {formatLimit(quota.limit, unit)}
        </span>
      </div>
      {quota.limit !== null && <Progress value={pct} className="h-2" label={`ใช้${noun}ไป ${pct}%`} />}
    </div>
  );
}

/** Shown when a create action hits the plan limit. */
export function UpgradeDialog({ open, onOpenChange, kind, quota }: { open: boolean; onOpenChange: (o: boolean) => void; kind: QuotaKind; quota: Quota }) {
  const { noun, unit } = QUOTA_LABEL[kind];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="เกินสิทธิ์แพ็กเกจปัจจุบัน" description={`แพ็กเกจของคุณมี${noun}ได้สูงสุด ${formatLimit(quota.limit, unit)}`}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-accent/10 p-3 text-sm">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <p>อัปเกรดเป็น <b>Pro</b> หรือ <b>Business</b> เพื่อเพิ่ม{noun}ได้มากขึ้น ข้อมูลเดิมทั้งหมดยังอยู่ครบ</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ไว้ทีหลัง</Button>
            <Button asChild><Link href="/plans" onClick={() => onOpenChange(false)}><Crown />ดูแพ็กเกจ</Link></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlanCard({ plan, current }: { plan: PlanRow; current: boolean }) {
  const featured = plan.tier === "PRO";
  return (
    <section
      aria-labelledby={`plan-${plan.tier}`}
      className={cn("relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm", featured && "border-primary ring-2 ring-primary/20", current && "bg-primary/5")}
    >
      {featured && <span className="absolute -top-3 left-5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">แนะนำ</span>}
      <div className="flex items-center justify-between gap-2">
        <h2 id={`plan-${plan.tier}`} className="text-lg font-bold">{plan.name}</h2>
        {current && <Badge tone="success">แพ็กเกจปัจจุบัน</Badge>}
      </div>
      <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
      <p className="mt-3">
        <span className="text-3xl font-bold tabular-nums">{formatPrice(plan.price_thb_month)}</span>
        {plan.price_thb_month > 0 && <span className="text-sm text-muted-foreground"> / เดือน</span>}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2 text-center text-xs">
        {(["projects", "properties", "members"] as const).map((k) => (
          <div key={k}>
            <dt className="text-muted-foreground">{k === "members" ? "สมาชิก" : QUOTA_LABEL[k].noun}</dt>
            <dd className="font-semibold">{formatLimit(plan[`max_${k}`], QUOTA_LABEL[k].unit)}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{f}</li>
        ))}
      </ul>
      {!current && plan.price_thb_month > 0 && (
        <Button asChild className="mt-5" variant={featured ? "default" : "outline"}>
          <a href={TON_AI.url} target="_blank" rel="noopener">ติดต่ออัปเกรด<ExternalLink /></a>
        </Button>
      )}
    </section>
  );
}
