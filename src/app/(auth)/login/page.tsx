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

type V = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { mode, status } = useAuth();
  const raw = params.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const [error, setError] = React.useState<string | null>(params.get("error") === "link" ? "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่" : null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  React.useEffect(() => {
    if (mode === "cloud" && status === "signed-in") router.replace(next);
  }, [mode, status, next, router]);

  if (mode === "local") return <LocalModeNotice />;

  const onSubmit = async (v: V) => {
    setError(null);
    const { error: e } = await getSupabase()!.auth.signInWithPassword(v);
    if (e) setError(authErrorMessage(e.message));
  };

  return (
    <>
      <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
      <p className="mb-6 text-sm text-muted-foreground">ยินดีต้อนรับกลับมา</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField id="email" label="อีเมล" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></FormField>
        <FormField id="password" label="รหัสผ่าน" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></FormField>
        <div className="text-right"><Link href="/forgot-password" className="text-sm text-primary hover:underline dark:text-secondary">ลืมรหัสผ่าน?</Link></div>
        {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}><LogIn />{isSubmitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">ยังไม่มีบัญชี? <Link href="/register" className="font-medium text-primary hover:underline dark:text-secondary">สมัครสมาชิก</Link></p>
    </>
  );
}

export default function LoginPage() {
  return <React.Suspense><LoginForm /></React.Suspense>;
}
