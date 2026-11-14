"use client";
import * as React from "react";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { ROLES, type Role } from "@/lib/domain/types";
import { ROLE_META } from "@/lib/domain/labels";
import { useAuth } from "@/providers/auth-provider";
import { useOnline } from "@/hooks/use-sync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

interface Member { user_id: string; role: Role; profiles: { email: string | null; full_name: string | null } | null }

export function MembersPanel({ projectId }: { projectId: string }) {
  const { userId, isAdmin, mode } = useAuth();
  const online = useOnline();
  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("VIEWER");
  const [busy, setBusy] = React.useState(false);
  const admin = isAdmin(projectId);

  const load = React.useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await sb.from("project_members").select("user_id, role, profiles(email, full_name)").eq("project_id", projectId).order("created_at");
    if (error) {
      setMembers([]);
      return;
    }
    setMembers(data as unknown as Member[]);
  }, [projectId]);

  React.useEffect(() => {
    if (mode === "cloud" && online) void load();
  }, [mode, online, load]);

  if (mode !== "cloud") return null;

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(ok);
      await load();
    }
  };
  const sb = getSupabase()!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>สมาชิกโครงการ</CardTitle>
        <CardDescription>แชร์ให้ผู้อื่นช่วยตรวจหรือดูรายงาน (ผู้ใช้ต้องสมัครบัญชีก่อน)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!online && <p className="text-sm text-warning-strong">ต้องออนไลน์เพื่อจัดการสมาชิก</p>}
        <ul className="divide-y rounded-lg border">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}{m.user_id === userId && " (คุณ)"}</p>
                <p className="truncate text-xs text-muted-foreground">{m.profiles?.email}</p>
              </div>
              {admin && m.user_id !== userId ? (
                <>
                  <Select aria-label="บทบาท" className="h-9 w-36" value={m.role} disabled={busy || !online}
                    onChange={(e) => void run(async () => await sb.from("project_members").update({ role: e.target.value }).eq("project_id", projectId).eq("user_id", m.user_id), "เปลี่ยนบทบาทแล้ว")}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                  </Select>
                  <Button variant="ghost" size="icon-sm" aria-label="ลบสมาชิก" disabled={busy || !online}
                    onClick={() => window.confirm("ลบสมาชิกออกจากโครงการ?") && void run(async () => await sb.from("project_members").delete().eq("project_id", projectId).eq("user_id", m.user_id), "ลบสมาชิกแล้ว")}>
                    <Trash2 />
                  </Button>
                </>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">{ROLE_META[m.role].label}</span>
              )}
            </li>
          ))}
          {members === null && <li className="p-3 text-sm text-muted-foreground">กำลังโหลด…</li>}
        </ul>
        {admin && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const target = email.trim().toLowerCase();
              if (!/^\S+@\S+\.\S+$/.test(target)) return void toast.error("อีเมลไม่ถูกต้อง");
              void run(async () => await sb.rpc("add_project_member", { p_project_id: projectId, p_email: target, p_role: role }), "เพิ่มสมาชิกแล้ว").then(() => setEmail(""));
            }}
          >
            <Input type="email" placeholder="อีเมลสมาชิก" aria-label="อีเมลสมาชิก" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select aria-label="บทบาท" className="sm:w-40" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </Select>
            <Button type="submit" disabled={busy || !online}><UserPlus />เพิ่ม</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
