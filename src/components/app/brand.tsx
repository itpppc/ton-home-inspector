import { cn } from "@/lib/utils";

/** Flat mark: ink plate, safety-orange roofline, paper check — reads like a stamp, prints in one pass. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-9", className)} aria-hidden>
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="6" fill="#1b1a17" stroke="#3a362e" strokeWidth="1.5" />
      <path d="M9 24 24 11l15 13" fill="none" stroke="#e8590c" strokeWidth="3.6" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M13 22v15h22V22" fill="none" stroke="#fffdf8" strokeWidth="2" strokeOpacity=".35" />
      <path d="m17.5 29 4.5 4.5 9-9.5" fill="none" stroke="#fffdf8" strokeWidth="3.2" strokeLinecap="square" />
    </svg>
  );
}

export function BrandLockup({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <p className={cn("text-[15px] font-bold tracking-tight", inverted ? "text-[#fffdf8]" : "text-foreground")}>TON Home Inspector</p>
        <p className={cn("whitespace-nowrap font-mono text-[9.5px] font-semibold tracking-[0.14em]", inverted ? "text-[#e8590c]" : "text-accent")}>INSIGHT · AUTOMATE · GROW</p>
      </div>
    </div>
  );
}
