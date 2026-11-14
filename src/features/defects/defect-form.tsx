"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HardHat, Lightbulb } from "lucide-react";
import { defectSchema, type DefectInput, type DefectValues } from "@/lib/domain/schemas";
import { SEVERITIES, type Defect, type InspectionScope, type Priority, type Room } from "@/lib/domain/types";
import { ENGINEERING_DISCLAIMER, SEVERITY_META } from "@/lib/domain/labels";
import { suggestSeverity } from "@/lib/domain/severity";
import { roomLabel } from "@/lib/seed/checklist-template";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DefectPrefill {
  title?: string;
  description?: string | null;
  category?: string | null;
  room_id?: string | null;
  priority?: Priority | null;
  scope?: InspectionScope | null;
}

const SEVERITY_RING: Record<string, string> = {
  LOW: "data-[on=true]:border-slate-500 data-[on=true]:bg-slate-500/10",
  MEDIUM: "data-[on=true]:border-cyan-600 data-[on=true]:bg-cyan-600/10",
  HIGH: "data-[on=true]:border-amber-600 data-[on=true]:bg-amber-600/10",
  CRITICAL: "data-[on=true]:border-red-600 data-[on=true]:bg-red-600/10",
};

export function DefectForm({ rooms, categories, initial, prefill, submitLabel = "บันทึก Defect", onSubmit }: {
  rooms: Room[];
  categories: string[];
  initial?: Defect;
  prefill?: DefectPrefill;
  submitLabel?: string;
  onSubmit: (v: DefectValues) => Promise<void>;
}) {
  const initialSuggestion = React.useMemo(
    () => (initial ? null : suggestSeverity({ text: `${prefill?.title ?? ""} ${prefill?.description ?? ""}`, priority: prefill?.priority, scope: prefill?.scope })),
    [initial, prefill],
  );
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<DefectInput, unknown, DefectValues>({
    resolver: zodResolver(defectSchema),
    defaultValues: {
      title: initial?.title ?? prefill?.title ?? "",
      description: initial?.description ?? prefill?.description ?? "",
      category: initial?.category ?? prefill?.category ?? "",
      room_id: initial?.room_id ?? prefill?.room_id ?? "",
      severity: initial?.severity ?? initialSuggestion?.severity ?? "MEDIUM",
      requires_engineer: initial?.requires_engineer ?? initialSuggestion?.requiresEngineer ?? false,
      recommendation: initial?.recommendation ?? "",
      due_date: initial?.due_date ?? "",
    },
  });
  const [title, description, severity, requiresEngineer] = watch(["title", "description", "severity", "requires_engineer"]);
  const suggestion = suggestSeverity({ text: `${title ?? ""} ${description ?? ""}`, priority: prefill?.priority, scope: prefill?.scope });
  const differs = suggestion.severity !== severity || (suggestion.requiresEngineer && !requiresEngineer);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={isSubmitting} className="contents">
        <FormField id="df-title" label="ปัญหาที่พบ" required error={errors.title?.message} className="sm:col-span-2">
          <Input {...register("title")} placeholder="เช่น รอยร้าวผนังใต้หน้าต่าง ยาว 30 ซม." />
        </FormField>
        <FormField id="df-desc" label="รายละเอียด (ขนาด ตำแหน่งที่แน่นอน)" error={errors.description?.message} className="sm:col-span-2">
          <Textarea rows={3} {...register("description")} />
        </FormField>
        <FormField id="df-room" label="ห้อง / ตำแหน่ง" error={errors.room_id?.message}>
          <Select {...register("room_id")}>
            <option value="">ไม่ระบุห้อง</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
          </Select>
        </FormField>
        <FormField id="df-cat" label="หมวดงาน" error={errors.category?.message}>
          <Input list="df-cat-list" {...register("category")} />
        </FormField>
        <datalist id="df-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">ระดับความรุนแรง <span className="text-danger" aria-hidden>*</span></legend>
          <div role="radiogroup" aria-label="ระดับความรุนแรง" className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {SEVERITIES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={severity === s} data-on={severity === s}
                onClick={() => setValue("severity", s, { shouldDirty: true })}
                className={cn("rounded-lg border-2 p-2.5 text-left transition-colors hover:bg-muted", SEVERITY_RING[s])}>
                <span className="flex items-center gap-1.5 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: SEVERITY_META[s].color }} aria-hidden />{SEVERITY_META[s].label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{SEVERITY_META[s].hint}</span>
              </button>
            ))}
          </div>
          {differs && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-accent/10 p-2.5 text-sm" role="status">
              <Lightbulb className="size-4 shrink-0 text-accent" aria-hidden />
              <span className="flex-1">
                ระบบแนะนำ <b>{SEVERITY_META[suggestion.severity].label}</b>
                {suggestion.requiresEngineer && " + ส่งวิศวกรตรวจ"}
                {suggestion.reasons.length > 0 && <span className="text-muted-foreground"> · {suggestion.reasons.join(", ")}</span>}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => {
                setValue("severity", suggestion.severity, { shouldDirty: true });
                if (suggestion.requiresEngineer) setValue("requires_engineer", true, { shouldDirty: true });
              }}>ใช้ตามแนะนำ</Button>
            </div>
          )}
        </fieldset>

        <label className="flex items-start gap-3 rounded-lg border p-3 sm:col-span-2">
          <input type="checkbox" className="mt-1 size-5 accent-[var(--color-accent)]" {...register("requires_engineer")} />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium"><HardHat className="size-4" aria-hidden />ต้องให้วิศวกรผู้มีใบอนุญาตตรวจสอบ</span>
            <span className="block text-xs text-muted-foreground">{ENGINEERING_DISCLAIMER}</span>
          </span>
        </label>

        <FormField id="df-rec" label="ข้อเสนอแนะการแก้ไข" error={errors.recommendation?.message} className="sm:col-span-2">
          <Textarea rows={2} {...register("recommendation")} />
        </FormField>
        <FormField id="df-due" label="กำหนดแก้ไขเสร็จ" error={errors.due_date?.message}>
          <Input type="date" {...register("due_date")} />
        </FormField>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" className="w-full sm:w-auto">{isSubmitting ? "กำลังบันทึก…" : submitLabel}</Button>
        </div>
      </fieldset>
    </form>
  );
}
