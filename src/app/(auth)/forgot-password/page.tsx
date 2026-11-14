"use client";
import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Mail, MailCheck } from "lucide-react";
import { forgotSchema } from "@/lib/domain/schemas";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocalModeNotice } from "@/features/auth/local-mode-notice";
import { authErrorMessage } from "@/features/auth/auth-errors";

type V = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { mode } = useAuth();
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  if (mode === "local") return <LocalModeNotice />;

  const onSubmit = async (v: V) => {
    setError(null);
    const { error: e } = await getSupabase()!.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    // Same response whether or not the account exists (no user enumeration), except transport errors.
    if (e && /fetch|network|rate/i.test(e.message)) return setError(authErrorMessage(e.message));
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto size-12 text-secondary-strong" />
        <h1 className="text-xl font-bold">ส่งลิงก์แล้ว</h1>
        <p className="text-sm text-muted-foreground">หากอีเมลนี้มีบัญชีอยู่ คุณจะได้รับลิงก์สำหรับตั้งรหัสผ่านใหม่</p>
        <Button asChild variant="outline" className="w-full"><Link href="/login">กลับไปหน้าเข้าสู่ระบบ</Link></Button>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">ลืมรหัสผ่าน</h1>
      <p className="mb-6 text-sm text-muted-foreground">กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField id="email" label="อีเมล" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></FormField>
        {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}><Mail />{isSubmitting ? "กำลังส่ง…" : "ส่งลิงก์"}</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-primary hover:underline dark:text-secondary">กลับไปหน้าเข้าสู่ระบบ</Link></p>
    </>
  );
}
