"use client";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  // Unique gradient id: a shared id breaks when another copy sits in a display:none subtree.
  const gid = `tonG${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 48 48" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#0b1f4b" />
      <path d="M10 23 24 11l14 12v14a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2Z" fill="none" stroke={`url(#${gid})`} strokeWidth="3.2" strokeLinejoin="round" />
      <path d="m17.5 28.5 4.5 4.5 9-9.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandLockup({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <p className={cn("text-[15px] font-bold tracking-tight", inverted ? "text-white" : "text-foreground")}>TON Home Inspector</p>
        <p className={cn("whitespace-nowrap text-[9.5px] font-semibold tracking-[0.1em]", inverted ? "text-secondary" : "text-secondary-strong")}>INSIGHT • AUTOMATE • GROW</p>
      </div>
    </div>
  );
}
