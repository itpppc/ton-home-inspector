import { BrandLockup } from "@/components/app/brand";
import { TonAiCredit } from "@/components/app/ton-ai-credit";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar p-10 text-[#fffdf8] lg:flex lg:flex-col lg:justify-between">
        <BrandLockup inverted />
        <div className="max-w-md space-y-4">
          <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-[#e8590c]">PRE-HANDOVER INSPECTION · FIELD LEDGER</p>
          <h2 className="text-4xl font-bold leading-[1.15]">ตรวจรับบ้าน<br />แบบช่างตรวจงาน<br /><span className="text-[#e8590c]">ด้วยมือคุณเอง</span></h2>
          <p className="text-sidebar-foreground">Checklist มาตรฐานกว่า 200 รายการ บันทึกผลได้แม้ไม่มีสัญญาณ ติดตามสิทธิ์แจ้งเก็บงานไม่ให้หลุดกำหนด</p>
        </div>
        <TonAiCredit inverted />
        {/* Blueprint linework instead of a decorative glow */}
        <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -right-16 top-24 w-[26rem] opacity-[0.12]">
          <g fill="none" stroke="#fffdf8" strokeWidth="1.5">
            <rect x="40" y="40" width="320" height="320" /><path d="M40 170h180v190M220 40v90h140M220 250h140M110 170v-60h-70" />
            <path d="M260 170a40 40 0 0 1 40 40" strokeDasharray="4 4" /><path d="M40 20h320M20 40v320" strokeDasharray="2 6" />
          </g>
        </svg>
      </div>
      <main className="bg-drafting flex items-center justify-center p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><BrandLockup /></div>
          {children}
          <TonAiCredit className="mt-10 justify-center lg:hidden" />
        </div>
      </main>
    </div>
  );
}
