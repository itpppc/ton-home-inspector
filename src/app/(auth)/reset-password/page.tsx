"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { resetSchema } from "@/lib/domain/schemas";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocalModeNotice } from "@/features/auth/local-mode-notice";
import { authErrorMessage } from "@/features/auth/auth-errors";

type V = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { mode, status } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });
  if (mode === "local") return <LocalModeNotice />;
  if (status === "signed-out") {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h1>
        <p className="text-sm text-muted-foreground">กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง</p>
        <Button asChild className="w-full"><Link href="/forgot-password">ขอลิงก์ใหม่</Link></Button>
      </div>
    );
  }
  const onSubmit = async (v: V) => {
    setError(null);
    const { error: e } = await getSupabase()!.auth.updateUser({ password: v.password });
    if (e) return setError(authErrorMessage(e.message));
    toast.success("ตั้งรหัสผ่านใหม่แล้ว");
    router.replace("/");
  };
  return (
    <>
      <h1 className="text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
      <p className="mb-6 text-sm text-muted-foreground">อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField id="password" label="รหัสผ่านใหม่" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register("password")} /></FormField>
        <FormField id="confirm" label="ยืนยันรหัสผ่าน" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register("confirm")} /></FormField>
        {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting || status === "loading"}><KeyRound />บันทึกรหัสผ่าน</Button>
      </form>
    </>
  );
}
