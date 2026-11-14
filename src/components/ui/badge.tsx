import * as React from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASS, type Tone } from "@/lib/domain/labels";

export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone], className)} {...p} />;
}
