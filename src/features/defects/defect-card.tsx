import Link from "next/link";
import { Camera, HardHat, MapPin } from "lucide-react";
import type { Defect } from "@/lib/domain/types";
import { DEFECT_STATUS_META, SEVERITY_META } from "@/lib/domain/labels";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export function DefectCard({ defect, photos }: { defect: Defect; photos: number }) {
  return (
    <Link href={`/defect?id=${defect.id}`} data-testid="defect-card"
      className="relative block overflow-hidden rounded-xl border bg-card p-3 pl-4 shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: SEVERITY_META[defect.severity].color }} aria-hidden />
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{defect.code}</span>
        <Badge tone={SEVERITY_META[defect.severity].tone}>{SEVERITY_META[defect.severity].label}</Badge>
        <Badge tone={DEFECT_STATUS_META[defect.status].tone}>{DEFECT_STATUS_META[defect.status].label}</Badge>
        {defect.requires_engineer && <Badge tone="accent"><HardHat className="size-3" aria-hidden />วิศวกร</Badge>}
      </div>
      <h3 className="font-medium leading-snug">{defect.title}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {defect.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" aria-hidden />{defect.location}</span>}
        <span>พบเมื่อ {formatDate(defect.found_at)}</span>
        {photos > 0 && <span className="inline-flex items-center gap-1"><Camera className="size-3" aria-hidden />{photos}</span>}
      </p>
    </Link>
  );
}
