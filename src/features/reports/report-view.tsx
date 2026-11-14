"use client";
import { TON_AI, tonAiCopyright } from "@/lib/brand/ton-ai";
import * as React from "react";
import { computeClaimDeadline } from "@/lib/domain/deadline";
import { DEFECT_STATUS_META, ENGINEERING_DISCLAIMER, ITEM_STATUS_META, SCOPE_META, SEVERITY_META } from "@/lib/domain/labels";
import { categoryProgress, checklistStats, defectStats } from "@/lib/domain/stats";
import { DEFECT_STATUSES, SEVERITIES, type Defect, type ItemStatus, type Photo } from "@/lib/domain/types";
import type { ReportData } from "@/lib/export/report-data";
import { usePhotoUrl } from "@/features/photos/photo-url";
import { formatDuration } from "@/lib/media/policy";
import { formatDate, formatDateTime } from "@/lib/utils";

/**
 * A4 report. Rendered as HTML so the browser shapes Thai correctly (stacked tone marks / vowels) —
 * canvas/PDF libraries without OpenType shaping drop or overlap them. "Print → Save as PDF" produces the PDF.
 * Colours are explicit (not theme tokens) so dark mode never leaks into the printout.
 */

const STATUS_COLOR: Record<ItemStatus, string> = {
  NOT_CHECKED: "text-neutral-500", PASS: "text-emerald-700", FAIL: "text-red-700", NEEDS_REINSPECTION: "text-amber-700", NOT_APPLICABLE: "text-slate-500",
};

function ReportPhoto({ photo }: { photo: Photo }) {
  const { url, missing } = usePhotoUrl(photo);
  if (photo.media_type === "video") {
    // A printed page cannot play video: show a labelled tile; the clip stays in the app/cloud.
    return (
      <figure className="break-inside-avoid">
        <div className="grid aspect-[4/3] place-items-center rounded border border-neutral-300 bg-neutral-800 text-center text-[11px] text-white">
          <span>▶ วิดีโอ {formatDuration(photo.duration_sec)}<br /><span className="text-[10px] opacity-70">ดูได้ในแอป TON Home Inspector</span></span>
        </div>
        <figcaption className="mt-0.5 text-[10px] text-neutral-600">{formatDateTime(photo.taken_at)}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="break-inside-avoid">
      <div className="aspect-[4/3] overflow-hidden rounded border border-neutral-300 bg-neutral-100" data-photo-loading={!url && !missing ? "" : undefined}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob/signed URL
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-[10px] text-neutral-400">{missing ? "ไม่มีไฟล์รูปในเครื่องนี้" : ""}</span>
        )}
      </div>
      <figcaption className="mt-0.5 text-[10px] text-neutral-600">{formatDateTime(photo.taken_at)}</figcaption>
    </figure>
  );
}

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-6 ${className}`}>
      <h2 className="mb-2 border-b-2 border-[#0B2545] pb-1 text-base font-bold text-[#0B2545]">{title}</h2>
      {children}
    </section>
  );
}

function DefectBlock({ defect, data }: { defect: Defect; data: ReportData }) {
  const photos = data.photos.filter((p) => p.defect_id === defect.id);
  const before = photos.filter((p) => p.kind === "DEFECT");
  const after = photos.filter((p) => p.kind === "AFTER_FIX");
  const events = data.events.filter((e) => e.defect_id === defect.id);
  const item = data.items.find((i) => i.id === defect.item_id);
  return (
    <article className="break-inside-avoid-page rounded border border-neutral-300 p-3 text-[12px] leading-snug">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] text-neutral-500">{defect.code}</span>
        <h3 className="flex-1 text-sm font-bold">{defect.title}</h3>
        <span className="rounded-full border px-2 text-[11px] font-semibold" style={{ borderColor: SEVERITY_META[defect.severity].color, color: SEVERITY_META[defect.severity].color }}>{SEVERITY_META[defect.severity].label}</span>
        <span className="rounded-full border px-2 text-[11px] font-semibold" style={{ borderColor: DEFECT_STATUS_META[defect.status].color, color: DEFECT_STATUS_META[defect.status].color }}>{DEFECT_STATUS_META[defect.status].label}</span>
      </header>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div><dt className="inline text-neutral-500">ตำแหน่ง: </dt><dd className="inline">{defect.location ?? "-"}</dd></div>
        <div><dt className="inline text-neutral-500">หมวดงาน: </dt><dd className="inline">{defect.category ?? "-"}</dd></div>
        <div><dt className="inline text-neutral-500">พบเมื่อ: </dt><dd className="inline">{formatDateTime(defect.found_at)}</dd></div>
        <div><dt className="inline text-neutral-500">กำหนดแก้: </dt><dd className="inline">{defect.due_date ? formatDate(defect.due_date) : "-"}</dd></div>
        {item && <div className="col-span-2"><dt className="inline text-neutral-500">หัวข้อตรวจ: </dt><dd className="inline">{item.code} {item.title}</dd></div>}
        {defect.description && <div className="col-span-2 whitespace-pre-wrap"><dt className="inline text-neutral-500">รายละเอียด: </dt><dd className="inline">{defect.description}</dd></div>}
        {defect.recommendation && <div className="col-span-2 whitespace-pre-wrap"><dt className="inline text-neutral-500">ข้อเสนอแนะ: </dt><dd className="inline">{defect.recommendation}</dd></div>}
      </dl>
      {defect.requires_engineer && <p className="mt-1.5 rounded bg-violet-50 p-1.5 text-[11px] text-violet-900"><b>ต้องให้วิศวกรผู้มีใบอนุญาตตรวจสอบและยืนยัน</b> — รายการนี้เป็นการคัดกรองเบื้องต้นเท่านั้น</p>}
      {before.length > 0 && <div className="mt-2"><p className="mb-1 font-semibold">ก่อนแก้ไข</p><div className="grid grid-cols-3 gap-2">{before.map((p) => <ReportPhoto key={p.id} photo={p} />)}</div></div>}
      {after.length > 0 && <div className="mt-2"><p className="mb-1 font-semibold">หลังแก้ไข</p><div className="grid grid-cols-3 gap-2">{after.map((p) => <ReportPhoto key={p.id} photo={p} />)}</div></div>}
      {events.length > 0 && (
        <ol className="mt-2 space-y-0.5 border-l-2 border-neutral-300 pl-2 text-[11px]">
          {events.map((e) => (
            <li key={e.id}><b>{DEFECT_STATUS_META[e.to_status].label}</b> <span className="text-neutral-500">· {formatDateTime(e.created_at)}</span>{e.note ? <span className="text-neutral-700"> — {e.note}</span> : null}</li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function ReportView({ data }: { data: ReportData }) {
  const { property, project } = data;
  const cs = checklistStats(data.items);
  const ds = defectStats(data.defects);
  const housePhotos = data.photos.filter((p) => p.kind === "PROPERTY" || p.kind === "PROJECT");
  const deadline = computeClaimDeadline({ transferDateActual: property.transfer_date_actual, transferDatePlanned: property.transfer_date_planned, windowDays: property.claim_window_days });
  const roomName = new Map(data.rooms.map((r) => [r.id, r.floor ? `${r.floor} - ${r.name}` : r.name]));
  const byCat = categoryProgress(data.categories, data.items);
  const defectCodes = new Map<string, string[]>();
  for (const d of data.defects) if (d.item_id) defectCodes.set(d.item_id, [...(defectCodes.get(d.item_id) ?? []), d.code]);
  const hasEngineering = data.items.some((i) => i.scope === "ENGINEERING") || data.defects.some((d) => d.requires_engineer);

  return (
    <div id="report-print" className="mx-auto w-full max-w-[210mm] bg-white p-6 text-neutral-900 shadow-sm sm:p-10 print:max-w-none print:p-0 print:shadow-none" style={{ fontFamily: "Sarabun, sans-serif" }}>
      <header className="border-b-4 border-[#0B2545] pb-3">
        <p className="text-xs font-semibold tracking-widest text-[#0B2545]">TON HOME INSPECTOR · INSIGHT • AUTOMATE • GROW</p>
        <h1 className="mt-1 text-2xl font-bold text-[#0B2545]">รายงานตรวจรับบ้าน</h1>
        <p className="text-sm text-neutral-600">สร้างเมื่อ {formatDateTime(data.generatedAt)}</p>
      </header>

      <Section title="ข้อมูลโครงการและบ้าน" className="mt-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
          {[
            ["โครงการ", project?.name ?? "-"], ["ผู้พัฒนา", project?.developer ?? "-"], ["บ้าน", property.name], ["เลขแปลง", property.plot_number ?? "-"],
            ["แบบบ้าน", property.house_model ?? "-"], ["ผู้ตรวจ", property.inspection_owner ?? "-"],
            ["วันโอนตามเอกสารจอง (อ้างอิง)", formatDate(property.transfer_date_planned)], ["วันจดทะเบียนโอนจริง", property.transfer_date_actual ? formatDate(property.transfer_date_actual) : "ยังไม่ได้บันทึก"],
          ].map(([k, v]) => <div key={k}><dt className="inline text-neutral-500">{k}: </dt><dd className="inline font-medium">{v}</dd></div>)}
          <div className="col-span-2"><dt className="inline text-neutral-500">วันสุดท้ายแจ้งเก็บงาน ({property.claim_window_days} วันนับจากวันโอนจริง): </dt><dd className="inline font-medium">{deadline.deadline ? formatDate(deadline.deadline) : "คำนวณเมื่อบันทึกวันโอนจริง"}</dd></div>
        </dl>
        {housePhotos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 break-inside-avoid" aria-label="รูปบ้าน / ผังบ้าน">
            {housePhotos.slice(0, 6).map((p) => <ReportPhoto key={p.id} photo={p} />)}
          </div>
        )}
      </Section>

      <Section title="สรุปผลการตรวจ">
        <div className="grid grid-cols-4 gap-2 text-center text-[13px]">
          {[["รายการทั้งหมด", cs.total, ""], ["ตรวจแล้ว", `${cs.checked} (${cs.progressPct}%)`, ""], ["ผ่าน", cs.counts.PASS, "text-emerald-700"], ["ไม่ผ่าน", cs.counts.FAIL, "text-red-700"],
            ["ต้องตรวจซ้ำ", cs.counts.NEEDS_REINSPECTION, "text-amber-700"], ["N/A", cs.counts.NOT_APPLICABLE, "text-slate-500"], ["ยังไม่ตรวจ", cs.counts.NOT_CHECKED, "text-neutral-500"], ["อัตราผ่าน", `${cs.passRatePct}%`, ""]].map(([k, v, c]) => (
            <div key={String(k)} className="rounded border border-neutral-300 p-2"><div className={`text-lg font-bold ${c}`}>{v}</div><div className="text-[11px] text-neutral-500">{k}</div></div>
          ))}
        </div>
        <h3 className="mb-1 mt-4 text-sm font-bold">Defect</h3>
        <div className="grid grid-cols-4 gap-2 text-center text-[13px]">
          {[["ทั้งหมด", ds.total, ""], ["ปิดงานแล้ว", ds.resolved, "text-emerald-700"], ["ยังค้าง", ds.pending, "text-amber-700"], ["วิกฤตที่ยังไม่ปิด", ds.criticalOpen, ds.criticalOpen ? "text-red-700" : ""]].map(([k, v, c]) => (
            <div key={String(k)} className="rounded border border-neutral-300 p-2"><div className={`text-lg font-bold ${c}`}>{v}</div><div className="text-[11px] text-neutral-500">{k}</div></div>
          ))}
        </div>
        {ds.total > 0 && (
          <table className="mt-2 w-full text-[12px]">
            <tbody>
              <tr>{SEVERITIES.map((s) => <td key={s} className="border border-neutral-300 p-1 text-center"><b style={{ color: SEVERITY_META[s].color }}>{SEVERITY_META[s].label}</b> {ds.bySeverity[s]}</td>)}</tr>
              <tr>{DEFECT_STATUSES.map((s) => <td key={s} className="border border-neutral-300 p-1 text-center text-[11px]">{DEFECT_STATUS_META[s].label}<br /><b>{ds.byStatus[s]}</b></td>)}</tr>
            </tbody>
          </table>
        )}
        {ds.criticalOpen > 0 && <p className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-[12px] font-semibold text-red-800">มี Defect ระดับวิกฤตที่ยังไม่ปิด {ds.criticalOpen} รายการ — ไม่ควรรับโอนจนกว่าจะแก้และตรวจซ้ำผ่าน</p>}
        <table className="mt-4 w-full text-[12px]">
          <thead><tr className="bg-neutral-100 text-left"><th className="border border-neutral-300 p-1">หมวด</th><th className="border border-neutral-300 p-1 text-center">รายการ</th><th className="border border-neutral-300 p-1 text-center">ผ่าน</th><th className="border border-neutral-300 p-1 text-center">ไม่ผ่าน</th><th className="border border-neutral-300 p-1 text-center">ตรวจซ้ำ</th><th className="border border-neutral-300 p-1 text-center">ยังไม่ตรวจ</th></tr></thead>
          <tbody>
            {byCat.map((c) => <tr key={c.id}><td className="border border-neutral-300 p-1">{c.name}</td><td className="border border-neutral-300 p-1 text-center">{c.total}</td><td className="border border-neutral-300 p-1 text-center">{c.counts.PASS}</td><td className="border border-neutral-300 p-1 text-center">{c.counts.FAIL}</td><td className="border border-neutral-300 p-1 text-center">{c.counts.NEEDS_REINSPECTION}</td><td className="border border-neutral-300 p-1 text-center">{c.counts.NOT_CHECKED}</td></tr>)}
          </tbody>
        </table>
      </Section>

      <Section title={`รายการ Defect (${ds.total})`} className="break-before-page">
        {data.defects.length === 0 ? <p className="text-sm text-neutral-500">ไม่มี Defect ที่บันทึก</p> : <div className="space-y-3">{data.defects.map((d) => <DefectBlock key={d.id} defect={d} data={data} />)}</div>}
      </Section>

      <Section title={`ผลตรวจรายหัวข้อ (${cs.total})`} className="break-before-page">
        {byCat.map((c) => (
          <div key={c.id} className="mb-4">
            <h3 className="mb-1 text-sm font-bold">{c.name} <span className="font-normal text-neutral-500">({c.total})</span></h3>
            <table className="w-full table-fixed text-[11px]">
              <thead><tr className="bg-neutral-100 text-left"><th className="w-[13%] border border-neutral-300 p-1">รหัส</th><th className="border border-neutral-300 p-1">หัวข้อ / ตำแหน่ง</th><th className="w-[14%] border border-neutral-300 p-1">ผล</th><th className="w-[28%] border border-neutral-300 p-1">หมายเหตุ</th></tr></thead>
              <tbody>
                {data.items.filter((i) => i.category_id === c.id).map((i) => (
                  <tr key={i.id} className="break-inside-avoid align-top">
                    <td className="border border-neutral-300 p-1 font-mono">{i.code}</td>
                    <td className="border border-neutral-300 p-1">{i.title}{i.scope === "ENGINEERING" && <span className="ml-1 text-violet-700">[{SCOPE_META.ENGINEERING.short}]</span>}<br /><span className="text-neutral-500">{(i.room_id ? roomName.get(i.room_id) : null) ?? i.location ?? ""}</span></td>
                    <td className={`border border-neutral-300 p-1 font-semibold ${STATUS_COLOR[i.status]}`}>{ITEM_STATUS_META[i.status].short}{defectCodes.get(i.id) ? <><br /><span className="font-mono text-[10px] font-normal">{defectCodes.get(i.id)!.join(", ")}</span></> : null}</td>
                    <td className="whitespace-pre-wrap border border-neutral-300 p-1">{i.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Section>

      <Section title="หมายเหตุสำคัญ" className="break-inside-avoid">
        <p className="rounded border border-violet-300 bg-violet-50 p-2 text-[12px] leading-relaxed text-violet-950">{ENGINEERING_DISCLAIMER}</p>
        {hasEngineering && <p className="mt-1 text-[11px] text-neutral-600">รายงานนี้มีรายการประเภท “ตรวจทางวิศวกรรม (คัดกรอง)” ซึ่งต้องให้วิศวกรผู้มีใบอนุญาตตรวจสอบและยืนยัน</p>}
        <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[12px]">
          {["ผู้ตรวจ", "ผู้แทนโครงการ / ผู้รับทราบ"].map((who) => (
            <div key={who}><div className="border-b border-neutral-500 pb-8" /><p className="mt-1">({who})</p><p className="text-neutral-500">วันที่ ____ / ____ / ________</p></div>
          ))}
        </div>
      </Section>

      <footer className="mt-8 flex items-center gap-3 border-t border-neutral-300 pt-3 text-[11px] text-neutral-600 break-inside-avoid">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG must render in print */}
        <img src={TON_AI.logo} alt="TON AI" width={28} height={28} className="rounded" />
        <div className="leading-tight">
          <p className="font-semibold text-neutral-800">{tonAiCopyright(new Date(data.generatedAt))}</p>
          <p>พัฒนาและออกแบบโดย {TON_AI.name} · <a href={TON_AI.url} className="text-cyan-800 underline">{TON_AI.host}</a></p>
        </div>
      </footer>
    </div>
  );
}
