"use client";
import { CalendarClock, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlan } from "@/features/plans/use-plan";
import { PlanBadge, PlanCard, UsageMeter } from "@/features/plans/plan-ui";
import { checkQuota, daysLeft, isExpired } from "@/features/plans/plans";
import { formatDate } from "@/lib/utils";

export default function PlansPage() {
  const auth = useAuth();
  const plan = usePlan();
  const my = plan.my;
  const left = daysLeft(my?.plan_expires_at ?? null);
  const unlimited = auth.mode === "local" || !!my?.unlimited;
  const current = unlimited ? null : (my?.effective ?? "FREE");

  return (
    <>
      <PageHeader title="แพ็กเกจสมาชิก" description="เลือกแพ็กเกจให้เหมาะกับจำนวนบ้านที่ต้องตรวจ" />

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">แพ็กเกจของคุณ {current && <PlanBadge tier={current} />}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {unlimited ? (
            <p className="flex items-center gap-2 text-sm">
              {auth.mode === "local" ? <InfinityIcon className="size-5 text-primary" aria-hidden /> : <ShieldCheck className="size-5 text-primary" aria-hidden />}
              {auth.mode === "local" ? "โหมดใช้งานในเครื่องนี้ (ไม่เชื่อม Cloud) ใช้งานได้ไม่จำกัด" : "ผู้ดูแลระบบ ใช้งานได้ไม่จำกัด"}
            </p>
          ) : plan.loading && !my ? (
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          ) : (
            <>
              {isExpired(my) && (
                <p role="status" className="rounded-lg bg-warning/12 p-3 text-sm text-warning">
                  แพ็กเกจ {my!.plan} หมดอายุเมื่อ {formatDate(my!.plan_expires_at)} ตอนนี้ใช้สิทธิ์ Free (ข้อมูลเดิมยังอยู่ครบ แต่เพิ่มใหม่ได้ตามสิทธิ์ Free)
                </p>
              )}
              {!isExpired(my) && left !== null && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="size-4" aria-hidden />ใช้ได้ถึง {formatDate(my!.plan_expires_at)} (อีก {left} วัน)
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <UsageMeter kind="projects" quota={checkQuota(my, "projects", plan.usage.projects)} />
                <UsageMeter kind="properties" quota={checkQuota(my, "properties", plan.usage.properties)} />
              </div>
              <p className="text-xs text-muted-foreground">นับเฉพาะโครงการที่คุณเป็นเจ้าของ · สมาชิกต่อโครงการสูงสุด {my?.max_members ?? "ไม่จำกัด"} คน</p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 pt-2 md:grid-cols-3">
        {plan.plans.map((p) => <PlanCard key={p.tier} plan={p} current={current === p.tier} />)}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        อัปเกรดโดยติดต่อทีม TON AI แล้วผู้ดูแลระบบจะเปิดสิทธิ์ให้ · หมดอายุหรือดาวน์เกรด ข้อมูลเดิมไม่หาย
      </p>
    </>
  );
}
