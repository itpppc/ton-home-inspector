"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { LogIn } from "lucide-react";
import { loginSchema } from "@/lib/domain/schemas";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocalModeNotice } from "@/features/auth/local-mode-notice";
import { authErrorMessage } from "@/features/auth/auth-errors";
import { safeNext } from "@/lib/auth/redirect";

type V = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { mode, status } = useAuth();
  const next = safeNext(params.get("next"));
  const linkError = params.get("error");
  const [error, setError] = React.useState<string | null>(linkError === "link" ? "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่" : null);
  const [notice, setNotice] = React.useState<string | null>(linkError === "other-browser" ? "ยืนยันอีเมลแล้ว กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน" : null);
  const [unconfirmed, setUnconfirmed] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  React.useEffect(() => {
    if (mode === "cloud" && status === "signed-in") router.replace(next);
  }, [mode, status, next, router]);

  if (mode === "local") return <LocalModeNotice />;

  const onSubmit = async (v: V) => {
    setError(null);
    setNotice(null);
    setUnconfirmed(null);
    const email = v.email.trim().toLowerCase();
    const { error: e } = await getSupabase()!.auth.signInWithPassword({ email, password: v.password });
    if (!e) return;
    setError(authErrorMessage(e.message));
    if (/email not confirmed/i.test(e.message)) setUnconfirmed(email);
  };

  const resend = async () => {
    if (!unconfirmed) return;
    setResending(true);
    const { error: e } = await getSupabase()!.auth.resend({ type: "signup", email: unconfirmed, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } });
    setResending(false);
    if (e) return setError(authErrorMessage(e.message));
    setError(null);
    setUnconfirmed(null);
    setNotice(`ส่งลิงก์ยืนยันใหม่ไปที่ ${unconfirmed} แล้ว (ถ้าไม่เห็น ดูในโฟลเดอร์ Spam)`);
  };

  return (
    <>
      <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
      <p className="mb-6 text-sm text-muted-foreground">ยินดีต้อนรับกลับมา</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField id="email" label="อีเมล" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></FormField>
        <FormField id="password" label="รหัสผ่าน" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></FormField>
        <div className="text-right"><Link href="/forgot-password" className="text-sm text-primary hover:underline dark:text-secondary">ลืมรหัสผ่าน?</Link></div>
        {notice && <p role="status" className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</p>}
        {error && (
          <div role="alert" className="space-y-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
            <p>{error}</p>
            {unconfirmed && <Button type="button" size="sm" variant="outline" onClick={() => void resend()} disabled={resending}>{resending ? "กำลังส่ง…" : "ส่งลิงก์ยืนยันอีกครั้ง"}</Button>}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}><LogIn />{isSubmitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">ยังไม่มีบัญชี? <Link href="/register" className="font-medium text-primary hover:underline dark:text-secondary">สมัครสมาชิก</Link></p>
    </>
  );
}

export default function LoginPage() {
  return <React.Suspense><LoginForm /></React.Suspense>;
}
