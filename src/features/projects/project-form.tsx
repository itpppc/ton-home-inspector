"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput, type ProjectValues } from "@/lib/domain/schemas";
import type { Project } from "@/lib/domain/types";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProjectForm({ initial, onSubmit, submitLabel = "บันทึก", disabled }: {
  initial?: Partial<Project>;
  onSubmit: (v: ProjectValues) => Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProjectInput, unknown, ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: initial?.name ?? "",
      developer: initial?.developer ?? "",
      developer_contact: initial?.developer_contact ?? "",
      location: initial?.location ?? "",
      description: initial?.description ?? "",
      inspection_date: initial?.inspection_date ?? "",
      reinspection_date: initial?.reinspection_date ?? "",
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <fieldset disabled={disabled || isSubmitting} className="contents">
        <FormField id="pj-name" label="ชื่อโครงการ" required error={errors.name?.message} className="sm:col-span-2"><Input {...register("name")} placeholder="เช่น Siri Place Rama 2" /></FormField>
        <FormField id="pj-dev" label="ผู้พัฒนาโครงการ (Developer)" error={errors.developer?.message}><Input {...register("developer")} /></FormField>
        <FormField id="pj-contact" label="ผู้ติดต่อโครงการ / เบอร์โทร" error={errors.developer_contact?.message}><Input {...register("developer_contact")} /></FormField>
        <FormField id="pj-loc" label="ที่ตั้งโครงการ" error={errors.location?.message} className="sm:col-span-2"><Input {...register("location")} /></FormField>
        <FormField id="pj-insp" label="วันนัดตรวจรับ" error={errors.inspection_date?.message}><Input type="date" {...register("inspection_date")} /></FormField>
        <FormField id="pj-reinsp" label="วันนัดตรวจซ้ำ" error={errors.reinspection_date?.message}><Input type="date" {...register("reinspection_date")} /></FormField>
        <FormField id="pj-desc" label="รายละเอียด" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register("description")} /></FormField>
        <div className="sm:col-span-2"><Button type="submit" className="w-full sm:w-auto">{isSubmitting ? "กำลังบันทึก…" : submitLabel}</Button></div>
      </fieldset>
    </form>
  );
}
