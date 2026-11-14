"use client";
import Link from "next/link";
import { CalendarClock, CircleAlert, Clock, ShieldAlert } from "lucide-react";
import type { Property } from "@/lib/domain/types";
import { computeClaimDeadline, type DeadlineInfo } from "@/lib/domain/deadline";
import { cn, formatDate } from "@/lib/utils";

export function deadlineCopy(info: DeadlineInfo, windowDays: number) {
  switch (info.state) {
    case "NO_ACTUAL_DATE":
      return { tone: "warning" as const, title: "ยังไม่ได้บันทึกวันโอนกรรมสิทธิ์จริง", body: `ระบบจะเริ่มนับสิทธิ์แจ้งเก็บงาน ${windowDays} วันเมื่อบันทึกวันโอนจริง${info.plannedDate ? ` · กำหนดตามเอกสารจอง ${formatDate(info.plannedDate)} (อ้างอิงเท่านั้น)` : ""}` };
    case "NOT_STARTED":
      return { tone: "info" as const, title: `วันโอน ${formatDate(info.transferDate)} · ยื่นได้ถึง ${formatDate(info.deadline)}`, body: `สิทธิ์แจ้งเก็บงาน ${windowDays} วันเริ่มนับวันถัดจากวันโอน` };
    case "OPEN":
      return { tone: "info" as const, title: `เหลือ ${info.daysRemaining} วัน ยื่นแจ้งเก็บงานได้ถึง ${formatDate(info.deadline)}`, body: "สิทธิ์มี 1 ครั้ง ควรรวบรวม Defect ให้ครบก่อนยื่น" };
    case "URGENT":
      return { tone: "danger" as const, title: `เร่งด่วน! เหลือ ${info.daysRemaining} วัน (ถึง ${formatDate(info.deadline)})`, body: "ตรวจรายการให้ครบและยื่นเอกสารแจ้งเก็บงานพร้อมหลักฐานการรับเรื่อง" };
    case "LAST_DAY":
      return { tone: "danger" as const, title: `วันนี้วันสุดท้าย (${formatDate(info.deadline)})`, body: "ยื่นแจ้งเก็บงานภายในวันนี้ และขอหลักฐานการรับเรื่องจากโครงการ" };
    case "EXPIRED":
      return { tone: "neutral" as const, title: `หมดระยะแจ้งเก็บงานแล้ว (${formatDate(info.deadline)})`, body: "งานที่พบหลังจากนี้ให้แจ้งตามเงื่อนไขการรับประกันของโครงการ" };
  }
}

const TONES = {
  warning: "border-warning/40 bg-warning/10 text-warning-strong",
  info: "border-secondary/40 bg-secondary/10 text-secondary-strong",
  danger: "border-danger/40 bg-danger/10 text-danger",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function DeadlineBanner({ property, className }: { property: Property; className?: string }) {
  const info = computeClaimDeadline({ transferDateActual: property.transfer_date_actual, transferDatePlanned: property.transfer_date_planned, windowDays: property.claim_window_days });
  const copy = deadlineCopy(info, property.claim_window_days);
  const Icon = info.state === "NO_ACTUAL_DATE" ? CircleAlert : info.state === "URGENT" || info.state === "LAST_DAY" ? ShieldAlert : info.state === "EXPIRED" ? Clock : CalendarClock;
  return (
    <div role={info.state === "URGENT" || info.state === "LAST_DAY" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border p-3 sm:p-4", TONES[copy.tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{copy.title}</p>
        <p className="text-sm opacity-90">{copy.body}</p>
      </div>
      {info.state === "NO_ACTUAL_DATE" && (
        <Link href={`/property?id=${property.id}#transfer`} className="shrink-0 self-center rounded-lg bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted">
          บันทึกวันโอน
        </Link>
      )}
    </div>
  );
}
