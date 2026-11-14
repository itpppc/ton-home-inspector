"use client";
import * as React from "react";
import { Ban, RefreshCw, Search, ShieldCheck, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { ROLES, type AdminUserRow, type Role } from "@/lib/domain/types";
import { ROLE_META } from "@/lib/domain/labels";
import { adminApi, adminStats, filterUsers, type AdminFilter } from "@/features/admin/admin-users";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/app/app-shell";
import { formatDate, formatDateTime } from "@/lib/utils";

const ROLE_TONE = { ADMIN: "accent", INSPECTOR: "info", VIEWER: "neutral" } as const;

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value.toLocaleString("th-TH")}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const auth = useAuth();
  const [rows, setRows] = React.useState<AdminUserRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<AdminFilter>("all");
  const [confirm, setConfirm] = React.useState<AdminUserRow | null>(null);
  const sb = getSupabase();
  const api = React.useMemo(() => (sb ? adminApi(sb) : null), [sb]);

  const load = React.useCallback(async () => {
    if (!api) return;
    setError(null);
    try {
      setRows(await api.list());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  React.useEffect(() => {
    if (auth.isSystemAdmin) void load();
  }, [auth.isSystemAdmin, load]);

  if (auth.mode === "local") return <EmptyState icon={ShieldCheck} title="ใช้ได้เมื่อเชื่อมต่อ Cloud" body="หน้าผู้ดูแลระบบจัดการบัญชีผู้ใช้บน Cloud" />;
  if (!auth.isSystemAdmin) return <EmptyState icon={ShieldCheck} title="เฉพาะผู้ดูแลระบบ" body="บัญชีนี้ไม่มีสิทธิ์เข้าหน้านี้" />;

  const run = async (row: AdminUserRow, label: string, fn: () => Promise<void>) => {
    setBusy(row.id);
    try {
      await fn();
      toast.success(label);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const changeRole = (row: AdminUserRow, role: Role) => run(row, `เปลี่ยน ${row.email} เป็น ${ROLE_META[role].label} แล้ว`, () => api!.setRole(row.id, role));
  const toggleDisabled = (row: AdminUserRow) =>
    run(row, row.disabled_at ? `เปิดใช้งาน ${row.email} แล้ว` : `ระงับ ${row.email} แล้ว`, () => api!.setDisabled(row.id, !row.disabled_at));

  const stats = rows ? adminStats(rows) : null;
  const shown = rows ? filterUsers(rows, query, filter) : [];

  return (
    <>
      <PageHeader
        title="ผู้ดูแลระบบ"
        description="จัดการบัญชีผู้ใช้ทั้งหมด · เห็นเฉพาะจำนวนโครงการ ไม่เห็นข้อมูลการตรวจของลูกค้า"
        actions={<Button variant="outline" onClick={() => void load()} disabled={!rows && !error}><RefreshCw className="size-4" />รีเฟรช</Button>}
      />
      {error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {!rows && !error && <div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy />}

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="ผู้ใช้ทั้งหมด" value={stats.total} hint={`ผู้ดูแล ${stats.admins} · ระงับ ${stats.suspended}`} />
          <Stat label="สมัครใหม่ 30 วัน" value={stats.newLast30} />
          <Stat label="ใช้งาน 30 วัน" value={stats.activeLast30} hint="เข้าสู่ระบบล่าสุด" />
          <Stat label="โครงการ / บ้าน" value={stats.projects} hint={`บ้านทั้งหมด ${stats.properties} หลัง`} />
        </div>
      )}

      {rows && (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="ค้นหาผู้ใช้" placeholder="ค้นหาอีเมลหรือชื่อ…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select aria-label="กรองสิทธิ์" value={filter} onChange={(e) => setFilter(e.target.value as AdminFilter)}>
              <option value="all">ทุกสิทธิ์</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
              <option value="SUSPENDED">ถูกระงับ</option>
            </Select>
          </div>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">แสดง {shown.length} จาก {rows.length} บัญชี</p>

          <ul className="grid gap-3 lg:grid-cols-2">
            {shown.map((u) => {
              const self = u.id === auth.userId;
              return (
                <li key={u.id}>
                  <Card className={u.disabled_at ? "opacity-70" : undefined}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted"><Users className="size-5 text-muted-foreground" aria-hidden /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{u.full_name || u.email || "ไม่มีชื่อ"}{self && <span className="ml-1 text-xs text-muted-foreground">(คุณ)</span>}</p>
                          <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={ROLE_TONE[u.role]}>{ROLE_META[u.role].label}</Badge>
                          {u.disabled_at && <Badge tone="danger">ระงับ</Badge>}
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                        <div><dt>สมัคร</dt><dd className="font-medium text-foreground">{formatDate(u.created_at)}</dd></div>
                        <div><dt>เข้าล่าสุด</dt><dd className="font-medium text-foreground">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "ยังไม่เคย"}</dd></div>
                        <div><dt>โครงการ</dt><dd className="font-medium text-foreground">{u.project_count}</dd></div>
                        <div><dt>บ้าน</dt><dd className="font-medium text-foreground">{u.property_count}</dd></div>
                      </dl>
                      {!self && (
                        <div className="flex flex-wrap gap-2">
                          <Select aria-label={`สิทธิ์ของ ${u.email}`} className="w-auto flex-1" value={u.role} disabled={busy === u.id} onChange={(e) => void changeRole(u, e.target.value as Role)}>
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].hint}</option>)}
                          </Select>
                          <Button variant={u.disabled_at ? "outline" : "destructive"} disabled={busy === u.id} onClick={() => (u.disabled_at ? void toggleDisabled(u) : setConfirm(u))}>
                            {u.disabled_at ? <><UserCheck className="size-4" />เปิดใช้งาน</> : <><Ban className="size-4" />ระงับ</>}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">ไม่พบผู้ใช้ตามตัวกรอง</p>}
        </>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm && (
          <DialogContent title="ระงับบัญชีนี้?" description={confirm.email ?? undefined}>
            <p className="text-sm">ผู้ใช้จะเข้าถึงโครงการและข้อมูลบน Cloud ไม่ได้ทันที ข้อมูลไม่ถูกลบ กด “เปิดใช้งาน” เพื่อคืนสิทธิ์ได้ทุกเมื่อ</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={() => { const u = confirm; setConfirm(null); void toggleDisabled(u); }}><Ban className="size-4" />ระงับบัญชี</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
