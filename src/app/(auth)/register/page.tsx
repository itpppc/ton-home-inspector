"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MailCheck, UserPlus } from "lucide-react";
import { registerSchema } from "@/lib/domain/schemas";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocalModeNotice } from "@/features/auth/local-mode-notice";
import { authErrorMessage } from "@/features/auth/auth-errors";

type V = z.input<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { mode } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(registerSchema), defaultValues: { full_name: "", email: "", password: "", confirm: "" } });

  if (mode === "local") return <LocalModeNotice />;
  if (sentTo) {
    return (
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto size-12 text-secondary-strong" />
        <h1 className="text-xl font-bold">ตรวจสอบอีเมลของคุณ</h1>
        <p className="text-sm text-muted-foreground">ส่งลิงก์ยืนยันไปที่ <b>{sentTo}</b> แล้ว คลิกลิงก์เพื่อเปิดใช้งานบัญชี</p>
        <Button asChild variant="outline" className="w-full"><Link href="/login">กลับไปหน้าเข้าสู่ระบบ</Link></Button>
      </div>
    );
  }

  const onSubmit = async (v: V) => {
    setError(null);
    const { data, error: e } = await getSupabase()!.auth.signUp({
      email: v.email.trim().toLowerCase(),
      password: v.password,
      options: { data: { full_name: v.full_name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    if (e) return setError(authErrorMessage(e.message));
    if (data.session) router.replace("/");
    else setSentTo(v.email.trim().toLowerCase());
  };

  return (
    <>
      <h1 className="text-2xl font-bold">สมัครสมาชิก</h1>
      <p className="mb-6 text-sm text-muted-foreground">สร้างบัญชีเพื่อเก็บข้อมูลบน Cloud และใช้ได้หลายอุปกรณ์</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField id="full_name" label="ชื่อ-นามสกุล" error={errors.full_name?.message}><Input autoComplete="name" {...register("full_name")} /></FormField>
        <FormField id="email" label="อีเมล" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></FormField>
        <FormField id="password" label="รหัสผ่าน" hint="อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register("password")} /></FormField>
        <FormField id="confirm" label="ยืนยันรหัสผ่าน" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register("confirm")} /></FormField>
        {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}><UserPlus />{isSubmitting ? "กำลังสมัคร…" : "สมัครสมาชิก"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">มีบัญชีแล้ว? <Link href="/login" className="font-medium text-primary hover:underline dark:text-secondary">เข้าสู่ระบบ</Link></p>
    </>
  );
}
