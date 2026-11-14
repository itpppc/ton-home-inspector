"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checklistItemSchema, type ChecklistItemInput, type ChecklistItemValues } from "@/lib/domain/schemas";
import { PRIORITIES, type ChecklistCategory, type ChecklistItem } from "@/lib/domain/types";
import { PRIORITY_META } from "@/lib/domain/labels";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ItemForm({ categories, locations, initial, defaultCategoryId, onSubmit }: {
  categories: ChecklistCategory[];
  locations: string[];
  initial?: ChecklistItem;
  defaultCategoryId?: string;
  onSubmit: (v: ChecklistItemValues) => Promise<void>;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ChecklistItemInput, unknown, ChecklistItemValues>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      category_id: initial?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "",
      code: initial?.code ?? "",
      location: initial?.location ?? "",
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      method: initial?.method ?? "",
      acceptance_criteria: initial?.acceptance_criteria ?? "",
      priority: initial?.priority ?? "MEDIUM",
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={isSubmitting} className="contents">
        <FormField id="it-title" label="หัวข้อที่ตรวจ" required error={errors.title?.message} className="sm:col-span-2"><Input {...register("title")} /></FormField>
        <FormField id="it-cat" label="หมวด" required error={errors.category_id?.message}>
          <Select {...register("category_id")}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </FormField>
        <FormField id="it-loc" label="ตำแหน่ง (ชั้น/ห้อง)" error={errors.location?.message}>
          <Input list="it-loc-list" {...register("location")} />
        </FormField>
        <datalist id="it-loc-list">{locations.map((l) => <option key={l} value={l} />)}</datalist>
        <FormField id="it-pri" label="ระดับความสำคัญ" error={errors.priority?.message}>
          <Select {...register("priority")}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}</Select>
        </FormField>
        <FormField id="it-code" label="รหัส" hint="เว้นว่างเพื่อสร้างอัตโนมัติ" error={errors.code?.message}><Input {...register("code")} /></FormField>
        <FormField id="it-desc" label="คำอธิบาย" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register("description")} /></FormField>
        <FormField id="it-method" label="วิธีตรวจสอบ" error={errors.method?.message} className="sm:col-span-2"><Textarea {...register("method")} /></FormField>
        <FormField id="it-crit" label="เกณฑ์ผ่าน (Acceptance Criteria)" error={errors.acceptance_criteria?.message} className="sm:col-span-2"><Textarea {...register("acceptance_criteria")} /></FormField>
        <div className="sm:col-span-2"><Button type="submit" className="w-full sm:w-auto">{isSubmitting ? "กำลังบันทึก…" : "บันทึก"}</Button></div>
      </fieldset>
    </form>
  );
}
