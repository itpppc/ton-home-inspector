"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { propertySchema, type PropertyInput, type PropertyValues } from "@/lib/domain/schemas";
import { CONSTRUCTION_STATUSES, type Property } from "@/lib/domain/types";
import { CONSTRUCTION_STATUS_META } from "@/lib/domain/labels";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function PropertyForm({ initial, onSubmit, submitLabel = "บันทึก", disabled, extra }: {
  initial?: Partial<Property>;
  onSubmit: (v: PropertyValues) => Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
  extra?: React.ReactNode;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PropertyInput, unknown, PropertyValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: initial?.name ?? "",
      plot_number: str(initial?.plot_number),
      house_model: str(initial?.house_model),
      property_type: str(initial?.property_type),
      land_area_sqw: str(initial?.land_area_sqw),
      usable_area_sqm: str(initial?.usable_area_sqm),
      floors: str(initial?.floors),
      construction_status: initial?.construction_status ?? "READY_FOR_INSPECTION",
      inspection_type: str(initial?.inspection_type ?? "Pre-handover Inspection"),
      inspection_owner: str(initial?.inspection_owner ?? "Project Owner"),
      transfer_date_planned: str(initial?.transfer_date_planned),
      transfer_date_actual: str(initial?.transfer_date_actual),
      claim_window_days: str(initial?.claim_window_days ?? 15),
      warranty_info: str(initial?.warranty_info),
      price: str(initial?.price),
      booking_fee: str(initial?.booking_fee),
      cashback: str(initial?.cashback),
      notes: str(initial?.notes),
    },
  });
  const num = { inputMode: "decimal" as const, autoComplete: "off" };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <fieldset disabled={disabled || isSubmitting} className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">ข้อมูลบ้าน</legend>
          <FormField id="pp-name" label="ชื่อบ้าน (Property Name)" required error={errors.name?.message} className="sm:col-span-2"><Input {...register("name")} /></FormField>
          <FormField id="pp-plot" label="เลขแปลง (Plot Number)" error={errors.plot_number?.message}><Input {...register("plot_number")} /></FormField>
          <FormField id="pp-model" label="แบบบ้าน (House Model)" error={errors.house_model?.message}><Input {...register("house_model")} /></FormField>
          <FormField id="pp-type" label="ประเภท (Property Type)" error={errors.property_type?.message}><Input {...register("property_type")} /></FormField>
          <FormField id="pp-status" label="สถานะก่อสร้าง (Construction Status)" error={errors.construction_status?.message}>
            <Select {...register("construction_status")}>{CONSTRUCTION_STATUSES.map((s) => <option key={s} value={s}>{CONSTRUCTION_STATUS_META[s]}</option>)}</Select>
          </FormField>
          <FormField id="pp-land" label="เนื้อที่ดิน (ตร.ว.)" error={errors.land_area_sqw?.message}><Input {...num} {...register("land_area_sqw")} /></FormField>
          <FormField id="pp-usable" label="พื้นที่ใช้สอย (ตร.ม.)" error={errors.usable_area_sqm?.message}><Input {...num} {...register("usable_area_sqm")} /></FormField>
          <FormField id="pp-floors" label="จำนวนชั้น" error={errors.floors?.message}><Input inputMode="numeric" {...register("floors")} /></FormField>
          <FormField id="pp-itype" label="ประเภทการตรวจ" error={errors.inspection_type?.message}><Input {...register("inspection_type")} /></FormField>
          <FormField id="pp-owner" label="ผู้รับผิดชอบการตรวจ" error={errors.inspection_owner?.message}><Input {...register("inspection_owner")} /></FormField>
        </section>

        <section id="transfer" className="scroll-mt-20 rounded-md border border-secondary/40 bg-secondary/5 p-4">
          <h3 className="mb-1 font-semibold">วันโอนกรรมสิทธิ์ & สิทธิ์แจ้งเก็บงาน</h3>
          <p className="mb-4 text-sm text-muted-foreground">ระบบคำนวณกำหนดยื่นแจ้งเก็บงานจาก <b>วันโอนจริง</b> เท่านั้น วันตามเอกสารจองใช้อ้างอิง</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="pp-tplan" label="กำหนดโอนตามเอกสารจอง" hint="อ้างอิงเท่านั้น" error={errors.transfer_date_planned?.message}><Input type="date" {...register("transfer_date_planned")} /></FormField>
            <FormField id="pp-tact" label="วันจดทะเบียนโอนจริง" hint="กรอกหลังโอนเสร็จที่กรมที่ดิน" error={errors.transfer_date_actual?.message}><Input type="date" {...register("transfer_date_actual")} /></FormField>
            <FormField id="pp-window" label="ระยะแจ้งเก็บงาน (วัน)" error={errors.claim_window_days?.message}><Input inputMode="numeric" {...register("claim_window_days")} /></FormField>
            <FormField id="pp-warranty" label="ข้อมูลการรับประกัน (Warranty)" error={errors.warranty_info?.message} className="sm:col-span-3"><Textarea {...register("warranty_info")} /></FormField>
          </div>
        </section>

        <section className="rounded-md border p-4">
          <h3 className="mb-1 font-semibold">ข้อมูลประกอบจากเอกสารจอง</h3>
          <p className="mb-4 text-sm text-muted-foreground">ไม่ใช่ส่วนหนึ่งของการประเมินคุณภาพทางวิศวกรรม</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="pp-price" label="ราคาบ้าน (บาท)" error={errors.price?.message}><Input {...num} {...register("price")} /></FormField>
            <FormField id="pp-booking" label="เงินจอง (บาท)" error={errors.booking_fee?.message}><Input {...num} {...register("booking_fee")} /></FormField>
            <FormField id="pp-cash" label="Cashback (บาท)" error={errors.cashback?.message}><Input {...num} {...register("cashback")} /></FormField>
            <FormField id="pp-notes" label="หมายเหตุ" error={errors.notes?.message} className="sm:col-span-3"><Textarea {...register("notes")} /></FormField>
          </div>
        </section>
        {extra}
        <Button type="submit" className="w-full sm:w-auto">{isSubmitting ? "กำลังบันทึก…" : submitLabel}</Button>
      </fieldset>
    </form>
  );
}
