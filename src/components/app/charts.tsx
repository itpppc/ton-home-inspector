/**
 * Dependency-free charts drawn with plain HTML/CSS (replaces recharts: −120 kB on the dashboard).
 * Styled like hand-ruled ledger bars; every chart has a text equivalent for screen readers.
 */
import { cn } from "@/lib/utils";

export const ITEM_STATUS_COLORS = { PASS: "#2e7d32", FAIL: "#c62828", NEEDS_REINSPECTION: "#b7791f", NOT_APPLICABLE: "#1f4e8c", NOT_CHECKED: "transparent" } as const;
const ITEM_LABEL = { PASS: "ผ่าน", FAIL: "ไม่ผ่าน", NEEDS_REINSPECTION: "ตรวจซ้ำ", NOT_APPLICABLE: "N/A", NOT_CHECKED: "ยังไม่ตรวจ" } as const;
type ItemKey = keyof typeof ITEM_STATUS_COLORS;
const KEYS: ItemKey[] = ["PASS", "FAIL", "NEEDS_REINSPECTION", "NOT_APPLICABLE", "NOT_CHECKED"];

export function Legend({ items, className }: { items: { label: string; color: string; value?: number }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 border border-foreground/30" style={{ background: i.color }} />
          {i.label}{i.value !== undefined && <b className="figure text-foreground">{i.value}</b>}
        </li>
      ))}
    </ul>
  );
}

/** One row per category: stacked status segments over an empty (unchecked) track. */
export function ProgressByCategoryChart({ data }: { data: ({ name: string } & Record<ItemKey, number>)[] }) {
  return (
    <div>
      <Legend className="mb-3" items={KEYS.filter((k) => k !== "NOT_CHECKED").map((k) => ({ label: ITEM_LABEL[k], color: ITEM_STATUS_COLORS[k] }))} />
      <ol className="divide-y divide-dashed divide-border">
        {data.map((row) => {
          const total = KEYS.reduce((n, k) => n + row[k], 0) || 1;
          const done = total - row.NOT_CHECKED;
          return (
            <li key={row.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[14rem_minmax(0,1fr)_4.5rem]">
              <span className="truncate text-sm">{row.name}</span>
              <span className="figure text-right text-xs text-muted-foreground sm:order-last">{done}/{total}</span>
              <div className="relative col-span-2 flex h-3 overflow-hidden rounded-[2px] bg-muted sm:col-span-1" role="img"
                aria-label={`${row.name}: ${KEYS.filter((k) => row[k]).map((k) => `${ITEM_LABEL[k]} ${row[k]}`).join(", ")}`}>
                {KEYS.filter((k) => k !== "NOT_CHECKED" && row[k] > 0).map((k) => (
                  <span key={k} className="h-full border-r border-card last:border-r-0" style={{ width: `${(row[k] / total) * 100}%`, background: ITEM_STATUS_COLORS[k] }} />
                ))}
                <span aria-hidden className="ruler-ticks pointer-events-none absolute inset-0" />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 100 % strip + itemised legend: reads faster than a donut on a phone. */
export function ShareBar({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((n, d) => n + d.value, 0);
  const shown = data.filter((d) => d.value > 0);
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2"><span className="figure text-3xl font-semibold">{total}</span><span className="text-sm text-muted-foreground">รายการ</span></p>
      <div className="flex h-5 overflow-hidden rounded-[2px] border border-foreground/20" role="img" aria-label={shown.map((d) => `${d.name} ${d.value}`).join(", ")}>
        {shown.map((d) => <span key={d.name} className="h-full border-r-2 border-card last:border-r-0" style={{ width: `${(d.value / (total || 1)) * 100}%`, background: d.color }} />)}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 border-b border-dashed border-border pb-1">
            <dt className="flex min-w-0 items-center gap-1.5"><span aria-hidden className="size-2.5 shrink-0" style={{ background: d.color }} /><span className="truncate">{d.name}</span></dt>
            <dd className="figure font-semibold">{d.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Ranked horizontal bars with the count printed at the end. */
export function SimpleBarChart({ data, color = "var(--color-signal)" }: { data: { name: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const rows = [...data].sort((a, b) => b.count - a.count);
  return (
    <ol className="space-y-2">
      {rows.map((d, i) => (
        <li key={d.name} className="grid grid-cols-[1.5rem_minmax(0,9rem)_minmax(0,1fr)_2rem] items-center gap-2 text-sm sm:grid-cols-[1.5rem_14rem_minmax(0,1fr)_2.5rem]">
          <span className="figure text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
          <span className="truncate">{d.name}</span>
          <span className="h-3 rounded-[2px] bg-muted"><span className="block h-full rounded-[2px]" style={{ width: `${(d.count / max) * 100}%`, background: color }} /></span>
          <span className="figure text-right font-semibold">{d.count}</span>
        </li>
      ))}
    </ol>
  );
}
