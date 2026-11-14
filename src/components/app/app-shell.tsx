"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bug, Building2, ClipboardCheck, DoorOpen, LayoutDashboard, ListChecks, LogOut, Moon, Sun, UserRound, LoaderCircle } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { selectProperty, useWorkspace } from "@/hooks/use-workspace";
import { useSync } from "@/hooks/use-sync";
import { ROLE_META } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";
import { BrandLockup, BrandMark } from "./brand";
import { SyncIndicator } from "./sync-indicator";

/** `mobile: false` items are desktop-sidebar only (mobile bottom nav holds 5; profile lives in the header). */
const NAV = [
  { href: "/", label: "Dashboard", short: "ภาพรวม", icon: LayoutDashboard, mobile: true },
  { href: "/inspect", label: "ตรวจบ้าน", short: "ตรวจบ้าน", icon: ClipboardCheck, mobile: true },
  { href: "/defects", label: "Defect", short: "Defect", icon: Bug, mobile: true },
  { href: "/checklist", label: "จัดการ Checklist", short: "Checklist", icon: ListChecks, mobile: true },
  { href: "/rooms", label: "ห้อง / ตำแหน่ง", short: "ห้อง", icon: DoorOpen, mobile: false },
  { href: "/projects", label: "โครงการ & บ้าน", short: "โครงการ", icon: Building2, mobile: true },
  { href: "/profile", label: "บัญชีผู้ใช้", short: "บัญชี", icon: UserRound, mobile: false },
] as const;

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`) || (href === "/projects" && (pathname === "/project" || pathname === "/property")) || (href === "/defects" && pathname === "/defect");

function PropertySwitcher() {
  const { properties, projects, property } = useWorkspace();
  if (properties.length === 0) return null;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">เลือกบ้านที่กำลังตรวจ</span>
      <select
        value={property?.id ?? ""}
        onChange={(e) => void selectProperty(e.target.value)}
        className="h-10 min-w-0 max-w-[60vw] truncate rounded-lg border border-input bg-card px-2 text-sm font-medium sm:max-w-xs"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.plot_number ? `${p.plot_number} · ` : ""}{p.house_model ?? p.name} — {projectName(p.project_id)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" onClick={() => setTheme(next)} className="grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label={next === "dark" ? "เปลี่ยนเป็นโหมดมืด" : "เปลี่ยนเป็นโหมดสว่าง"}>
      <Sun className="hidden size-5 dark:block" aria-hidden />
      <Moon className="size-5 dark:hidden" aria-hidden />
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, mode, profile, email, signOut } = useAuth();
  const { pending } = useSync();

  React.useEffect(() => {
    if (status === "signed-out") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "signed-in") {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <BrandMark className="size-12" />
          <LoaderCircle className="size-5 animate-spin" aria-label="กำลังโหลด" />
        </div>
      </div>
    );
  }

  const onSignOut = async () => {
    if (pending > 0 && !window.confirm(`ยังมี ${pending} รายการที่ยังไม่ได้ Sync ขึ้น Cloud ต้องการออกจากระบบหรือไม่? (ข้อมูลยังอยู่ในเครื่องนี้)`)) return;
    await signOut();
  };

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:p-2">ข้ามไปเนื้อหาหลัก</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-white/10 px-5 py-5"><BrandLockup inverted /></div>
        <nav className="flex-1 space-y-1 p-3" aria-label="เมนูหลัก">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-secondary)]" : "hover:bg-white/5 hover:text-white")}>
                <Icon className="size-5" aria-hidden />{label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-sm">
          <p className="truncate font-medium text-white">{profile?.full_name ?? email ?? "ผู้ใช้"}</p>
          <p className="truncate text-xs opacity-75">{mode === "local" ? "Local mode · เครื่องนี้" : `${email ?? ""} · ${ROLE_META[profile?.role ?? "INSPECTOR"].label}`}</p>
          {mode === "cloud" && (
            <button type="button" onClick={() => void onSignOut()} className="mt-3 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white/10">
              <LogOut className="size-4" aria-hidden />ออกจากระบบ
            </button>
          )}
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
          <div className="lg:hidden"><BrandMark className="size-8" /></div>
          <PropertySwitcher />
          <div className="ml-auto flex items-center gap-1.5">
            <SyncIndicator />
            <Link href="/profile" className="grid size-10 place-items-center rounded-lg hover:bg-muted lg:hidden" aria-label="บัญชีผู้ใช้"><UserRound className="size-5" aria-hidden /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-3 pb-28 pt-4 sm:px-5 lg:pb-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-safe lg:hidden" aria-label="เมนูหลัก">
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => n.mobile).map(({ href, short, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-primary dark:text-secondary" : "text-muted-foreground")}>
                  <Icon className={cn("size-6", active && "stroke-[2.4]")} aria-hidden />{short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Icon className="size-10 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
