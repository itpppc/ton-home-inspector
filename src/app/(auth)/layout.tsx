import { BrandLockup } from "@/components/app/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <BrandLockup inverted />
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-bold leading-tight">ตรวจรับบ้านอย่างมืออาชีพ<br />ด้วยตัวคุณเอง</h2>
          <p className="text-sidebar-foreground">Checklist มาตรฐานกว่า 180 รายการ บันทึกผลได้แม้ไม่มีสัญญาณ ติดตามสิทธิ์แจ้งเก็บงานไม่ให้หลุดกำหนด</p>
        </div>
        <p className="text-xs text-sidebar-foreground/70">© TON AI · INSIGHT • AUTOMATE • GROW</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-gradient-to-br from-secondary/40 to-accent/40 blur-3xl" />
      </div>
      <main className="flex items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><BrandLockup /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
