import { TON_AI, tonAiCopyright } from "@/lib/brand/ton-ai";
import { cn } from "@/lib/utils";

/** Developer credit + copyright linking to the TON AI website. Server-safe (no hooks). */
export function TonAiCredit({ className, inverted = false, compact = false }: { className?: string; inverted?: boolean; compact?: boolean }) {
  const size = compact ? 24 : 32;
  return (
    <a
      href={TON_AI.url}
      target="_blank"
      rel="noopener"
      className={cn("group flex items-center gap-2.5 rounded-lg text-xs", inverted ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground", className)}
      aria-label={`${tonAiCopyright()} — เปิดเว็บไซต์ ${TON_AI.host}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, cached for offline */}
      <img src={TON_AI.logo} alt="" width={size} height={size} className="shrink-0 rounded-md" />
      <span className="leading-tight">
        <span className="block">{tonAiCopyright()}</span>
        {!compact && (
          <span className="block opacity-80">
            พัฒนาโดย TON AI · <span className="underline-offset-2 group-hover:underline">{TON_AI.host}</span>
          </span>
        )}
      </span>
    </a>
  );
}
