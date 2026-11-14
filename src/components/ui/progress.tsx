import { cn } from "@/lib/utils";

/** Flat measuring-tape bar: signal fill over ruler ticks every 10 %. */
export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label} className={cn("relative h-2.5 w-full overflow-hidden rounded-[2px] bg-muted", className)}>
      <div className="h-full bg-signal transition-[width] duration-500" style={{ width: `${v}%` }} />
      <div aria-hidden className="ruler-ticks pointer-events-none absolute inset-0" />
    </div>
  );
}
