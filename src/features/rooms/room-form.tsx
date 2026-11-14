"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roomSchema, type RoomInput, type RoomValues } from "@/lib/domain/schemas";
import type { Room } from "@/lib/domain/types";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RoomForm({ initial, floors, onSubmit }: { initial?: Room; floors: string[]; onSubmit: (v: RoomValues) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RoomInput, unknown, RoomValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: { name: initial?.name ?? "", floor: initial?.floor ?? "" },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <fieldset disabled={isSubmitting} className="contents">
        <FormField id="rm-floor" label="ชั้น" hint="เช่น ชั้น 1, ชั้น 2, ภายนอก (เว้นว่างได้)" error={errors.floor?.message}>
          <Input list="rm-floor-list" {...register("floor")} />
        </FormField>
        <datalist id="rm-floor-list">{floors.map((f) => <option key={f} value={f} />)}</datalist>
        <FormField id="rm-name" label="ชื่อห้อง" required error={errors.name?.message}>
          <Input autoFocus {...register("name")} />
        </FormField>
        <Button type="submit">{isSubmitting ? "กำลังบันทึก…" : "บันทึก"}</Button>
      </fieldset>
    </form>
  );
}
