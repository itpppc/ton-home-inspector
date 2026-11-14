"use client";
import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Crown, KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { profileSchema } from "@/lib/domain/schemas";
import { ROLE_META } from "@/lib/domain/labels";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { useSync } from "@/hooks/use-sync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/app-shell";
import { InstallButton } from "@/features/pwa/install-ui";
import { TonAiCredit } from "@/components/app/ton-ai-credit";
import { formatDateTime } from "@/lib/utils";

type V = z.infer<typeof profileSchema>;

function ProfileForm() {
  const { profile, userId, refreshProfile } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(profileSchema), values: { full_name: profile?.full_name ?? "" } });
  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
      const sb = getSupabase();
      if (!sb || !userId) return;
      const { error } = await sb.from("profiles").update({ full_name: v.full_name }).eq("id", userId);
      if (error) return void toast.error(error.message);
      await refreshProfile();
      toast.success("บันทึกโปรไฟล์แล้ว");
    })}>
      <FormField id="full_name" label="ชื่อ-นามสกุล" error={errors.full_name?.message}><Input {...register("full_name")} /></FormField>
      <Button type="submit" disabled={isSubmitting}>บันทึก</Button>
    </form>
  );
}

export default function ProfilePage() {
  const auth = useAuth();
  const sync = useSync();
  const { theme, setTheme } = useTheme();
  const role = auth.profile?.role ?? "INSPECTOR";

  return (
    <>
      <PageHeader title="บัญชีผู้ใช้" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>โปรไฟล์</CardTitle>
            <CardDescription>{auth.mode === "local" ? "Local mode — ข้อมูลอยู่ในเครื่องนี้เท่านั้น" : auth.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">บทบาทหลัก <Badge tone="accent">{auth.isSystemAdmin ? "ผู้ดูแลระบบ" : ROLE_META[role].label}</Badge><span className="text-muted-foreground">{auth.isSystemAdmin ? "จัดการบัญชีผู้ใช้ทั้งระบบ" : ROLE_META[role].hint}</span></div>
            {auth.mode === "cloud" && !auth.isSystemAdmin && <Button asChild variant="outline" className="w-full sm:w-auto"><Link href="/plans"><Crown className="size-4" />แพ็กเกจสมาชิก & สิทธิ์ใช้งาน</Link></Button>}
            {auth.isSystemAdmin && <Button asChild variant="outline" className="w-full sm:w-auto"><Link href="/admin"><ShieldCheck className="size-4" />เปิดหน้าผู้ดูแลระบบ</Link></Button>}
            {auth.mode === "cloud" ? (
              <>
                <ProfileForm />
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button asChild variant="outline"><Link href="/reset-password"><KeyRound />เปลี่ยนรหัสผ่าน</Link></Button>
                  <Button variant="outline" className="text-danger" onClick={async () => {
                    if (sync.pending > 0 && !window.confirm(`ยังมี ${sync.pending} รายการที่ยังไม่ได้ Sync ต้องการออกจากระบบหรือไม่?`)) return;
                    await auth.signOut();
                  }}><LogOut />ออกจากระบบ</Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">เมื่อเชื่อม Supabase แล้ว ให้สมัคร/เข้าสู่ระบบ ข้อมูลในเครื่องนี้จะถูกย้ายขึ้นบัญชีของคุณอัตโนมัติ</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>การซิงค์ข้อมูล</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>สถานะ: <b>{auth.mode === "local" ? "Local mode" : sync.phase}</b></p>
              <p>รอส่งขึ้น Cloud: <b>{sync.pending}</b> รายการ</p>
              <p>Sync ล่าสุด: {formatDateTime(sync.lastSyncedAt)}</p>
              {sync.lastError && <p className="rounded-lg bg-danger/10 p-2 text-danger">{sync.lastError}</p>}
              {auth.mode === "cloud" && <Button variant="outline" onClick={() => void sync.syncNow()}><RefreshCw />Sync ตอนนี้</Button>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>ติดตั้งแอป</CardTitle>
              <CardDescription>ใช้ได้ทั้ง iPhone, iPad, Android และคอมพิวเตอร์ เปิดเต็มจอและทำงานแบบออฟไลน์</CardDescription>
            </CardHeader>
            <CardContent><InstallButton className="w-full sm:w-auto" /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>เกี่ยวกับแอป</CardTitle>
              <CardDescription>TON Home Inspector · ระบบตรวจรับบ้านและติดตามงานแก้ไข</CardDescription>
            </CardHeader>
            <CardContent><TonAiCredit /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>การแสดงผล</CardTitle></CardHeader>
            <CardContent>
              <FormField id="theme" label="ธีม">
                <Select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
                  <option value="system">ตามระบบ</option>
                  <option value="light">สว่าง</option>
                  <option value="dark">มืด (Dark Navy)</option>
                </Select>
              </FormField>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
