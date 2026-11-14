"use client";
import * as React from "react";
import { Download, EllipsisVertical, ExternalLink, Share, SquarePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BrandMark } from "@/components/app/brand";
import type { Env } from "./install-state";
import { useInstall } from "./use-install";

const DISMISS_KEY = "ton.install.dismissedAt";
const DISMISS_DAYS = 14;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

/** Opens the current page in the phone's real browser (LINE supports ?openExternalBrowser=1). */
function externalUrl() {
  const u = new URL(window.location.href);
  u.searchParams.set("openExternalBrowser", "1");
  return u.toString();
}

/** Per-OS manual steps, used when the browser offers no native install dialog. */
export function InstallSteps({ env }: { env: Env }) {
  if (env.browser === "in-app") {
    return (
      <div className="space-y-3 text-sm">
        <p>แอปที่เปิดลิงก์อยู่ (เช่น LINE, Facebook) ติดตั้งแอปไม่ได้ ต้องเปิดใน{env.platform === "ios" ? " Safari" : " Chrome"} ก่อน</p>
        <ol className="space-y-3">
          <Step n={1}>กดปุ่มด้านล่าง หรือเมนู <EllipsisVertical className="inline size-4" aria-label="เมนู" /> แล้วเลือก “เปิดในเบราว์เซอร์”</Step>
          <Step n={2}>จากนั้นกด “ติดตั้งแอป” อีกครั้งในเบราว์เซอร์</Step>
        </ol>
        <Button asChild className="w-full"><a href={externalUrl()} target="_blank" rel="noopener"><ExternalLink className="size-4" />เปิดในเบราว์เซอร์</a></Button>
      </div>
    );
  }
  if (env.platform === "ios") {
    return (
      <div className="space-y-3 text-sm">
        {env.browser !== "safari" && <p className="rounded-lg bg-muted p-3">แนะนำให้ใช้ <b>Safari</b> (iOS 16.4 ขึ้นไปใช้ Chrome ได้เช่นกัน)</p>}
        <ol className="space-y-3">
          <Step n={1}>กดปุ่ม <b>แชร์</b> <Share className="inline size-4" aria-hidden /> {env.browser === "safari" ? "ที่แถบด้านล่าง (iPad อยู่ด้านบน)" : "ที่แถบที่อยู่"}</Step>
          <Step n={2}>เลื่อนลงแล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b> <SquarePlus className="inline size-4" aria-hidden /></Step>
          <Step n={3}>กด <b>เพิ่ม</b> ที่มุมขวาบน แล้วเปิดแอปจากไอคอน TON Inspector</Step>
        </ol>
      </div>
    );
  }
  if (env.platform === "android") {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>กดเมนู <EllipsisVertical className="inline size-4" aria-label="เมนู" /> {env.browser === "samsung" ? "(ขีด 3 เส้น ด้านล่าง)" : "มุมขวาบน"}</Step>
        <Step n={2}>เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มไปที่หน้าจอหลัก</b></Step>
        <Step n={3}>กด <b>ติดตั้ง</b> แล้วเปิดจากไอคอน TON Inspector</Step>
      </ol>
    );
  }
  return (
    <ol className="space-y-3 text-sm">
      <Step n={1}>ใช้ Chrome หรือ Edge แล้วกดไอคอน <Download className="inline size-4" aria-hidden /> ติดตั้ง ที่ท้ายแถบที่อยู่</Step>
      <Step n={2}>หรือเมนู <EllipsisVertical className="inline size-4" aria-label="เมนู" /> → <b>ติดตั้ง TON Home Inspector</b></Step>
      <Step n={3}>Safari บน Mac: เมนู File → <b>Add to Dock</b></Step>
    </ol>
  );
}

/** One button that does the right thing on every OS: native prompt when available, steps otherwise. */
export function InstallButton({ className, label = "ติดตั้งแอป" }: { className?: string; label?: string }) {
  const { env, canPrompt, installed, install } = useInstall();
  const [open, setOpen] = React.useState(false);
  if (!env) return null;
  if (installed) return <p className={className}>ติดตั้งแอปบนเครื่องนี้แล้ว ✓</p>;
  const onClick = async () => {
    if (canPrompt) {
      if (await install()) toast.success("ติดตั้งแอปแล้ว เปิดได้จากหน้าจอหลัก");
      return;
    }
    setOpen(true);
  };
  return (
    <>
      <Button type="button" className={className} onClick={() => void onClick()}><Download className="size-4" />{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="ติดตั้ง TON Home Inspector" description="ใช้งานเต็มจอ เปิดเร็ว และตรวจบ้านได้แม้ไม่มีสัญญาณ">
          <InstallSteps env={env} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Dismissible prompt shown inside the app until installed (hidden for 14 days after closing). */
export function InstallBanner() {
  const { env, installed } = useInstall();
  const [hidden, setHidden] = React.useState(true);
  React.useEffect(() => setHidden(dismissedRecently()), []);
  if (!env || installed || hidden) return null;
  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setHidden(true);
  };
  return (
    <div role="region" aria-label="ติดตั้งแอป" className="mb-4 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm print:hidden">
      <BrandMark className="size-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">ติดตั้งแอปลงมือถือ</p>
        <p className="text-xs text-muted-foreground">เปิดจากหน้าจอหลัก ใช้ตรวจบ้านได้แม้ไม่มีเน็ต</p>
      </div>
      <InstallButton label="ติดตั้ง" className="shrink-0" />
      <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="ปิด ไม่ต้องแสดงอีก 14 วัน"><X className="size-4" /></button>
    </div>
  );
}
