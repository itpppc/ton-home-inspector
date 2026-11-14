# TON Home Inspector — Task Tracker

> อัปเดต: 14 Nov 2026 (Phase 2 build) · Legend: ✅ เสร็จ · 🟡 กำลังทำ · ⬜ ยังไม่เริ่ม · ⏸ รออนุมัติ/ข้อมูล
> กติกา: ทำทีละขั้น รายงานผล แล้ว **รอ TON AI สั่งก่อนเริ่มขั้นถัดไปทุกครั้ง**

## Key Dates
| วันที่ | เหตุการณ์ |
|---|---|
| 14 Nov | วางแผน + อนุมัติ |
| 16 Nov | P1 MVP พร้อมทดลองบนมือถือ |
| 17 Nov | ซ้อมใช้งานจริง / แก้ไข |
| **18 Nov** | **กำหนดโอนตามเอกสารจอง** (ใช้ตรวจหน้างาน) |
| วันโอนจริง + 15 | วันสุดท้ายยื่นแจ้งเก็บงาน (คำนวณเมื่อกรอกวันโอนจริง) |

---

## P0 — Planning
| ID | Task | Status |
|---|---|---|
| P0-1 | ตรวจ repo / Supabase เดิม | ✅ ไม่พบระบบเดิม |
| P0-2 | PROJECT_PLAN.md | ✅ |
| P0-3 | DATABASE_SCHEMA.md | ✅ |
| P0-4 | TASK_TRACKER.md | ✅ |
| P0-5 | TON AI review + ตอบ Open Questions | ✅ อนุมัติเริ่ม Phase 1 |
| P0-6 | ได้รับ Master Prompt ส่วนที่เหลือ | ⏸ |

## P1 — MVP ใช้ตรวจหน้างาน (Local mode, offline)
| ID | Task | Est. | Status |
|---|---|---|---|
| P1-1 | Project setup: Next.js 15, TS strict, Tailwind 4, shadcn/ui, ESLint, Vitest | 1h | ✅ |
| P1-2 | Design system: tokens Navy/Cyan/Purple, Sarabun, Dark mode, UI primitives | 2h | ✅ |
| P1-3 | Domain: types, Zod schemas, progress/stats, deadline (+unit tests) | 1.5h | ✅ + unit tests |
| P1-4 | Local DB (Dexie) + repositories + outbox | 2h | ✅ |
| P1-5 | Seed: default project/property + checklist template ~180 รายการ | 1h | ✅ 206 รายการ |
| P1-6 | App shell: Sidebar (desktop), Bottom nav (mobile), Header, Property switcher | 2h | ✅ |
| P1-7 | Property page: ข้อมูลบ้าน, **บันทึกวันโอนจริง**, Deadline banner, .ics | 2h | ✅ (ยกเว้น .ics) |
| P1-8 | **Inspection checklist**: filter หมวด/ห้อง/สถานะ, tap status, note, ค้นหา | 3h | ✅ |
| P1-9 | Checklist editor: เพิ่ม/แก้/ลบ/เรียงหัวข้อและหมวด | 2h | ✅ + คัดลอกจากบ้านอื่น |
| P1-10 | **Photo capture**: กล้องมือถือ, บีบอัด, เก็บ IndexedDB, gallery | 2h | ✅ Phase 2 (+ อัปโหลด Storage ก่อน push แถวรูป) |
| P1-11 | **Defect**: สร้างจาก FAIL, severity, ตำแหน่ง, workflow, history, Before/After | 3h | ✅ Phase 2 |
| P1-12 | Dashboard: KPI 9 ตัว + Progress + กราฟ 4 แบบ | 2h | ✅ |
| P1-13 | **PDF report** (jsPDF + Sarabun) + Print layout A4 | 3h | ⬜ |
| P1-14 | **Excel export** (Summary / Checklist / Defects / History) | 1.5h | ⬜ |
| P1-15 | PWA: manifest, icons, Service Worker, offline test, storage persist | 2h | ✅ |
| P1-16 | Backup / Restore JSON (กันข้อมูลหายก่อนมี cloud) | 1h | ⬜ |
| P1-17 | Verify: typecheck, lint, unit tests, build, ทดสอบ mobile viewport | 1.5h | ✅ |

## P2 — Cloud & Auth
| ID | Task | Status |
|---|---|---|
| P2-1 | สร้าง Supabase project (ต้องอนุมัติ) | ⏸ รอคำอนุมัติแบบระบุชื่อ |
| P2-2 | Migrations 0001–0003 (tables, RLS, storage) + advisors check | 🟡 เขียน + ทดสอบบน Postgres 16 แล้ว (39/39) รอ apply |
| P2-3 | Auth: Login, Register, Forgot/Reset Password, Profile, middleware session | 🟡 โค้ดเสร็จ รอทดสอบกับ Supabase จริง |
| P2-4 | Sync engine: push/pull, photo upload, retry, status indicator | 🟡 push/pull เสร็จ (photo upload รอ module รูป) |
| P2-5 | Roles + UI guard + RPC เชิญสมาชิก | ✅ |
| P2-6 | ย้ายข้อมูลจาก Local mode ขึ้น Cloud เมื่อ login ครั้งแรก | ✅ |
| P2-7 | Unit tests: sync merge/conflict, RLS smoke test | ⬜ |

## P3 — Deploy
| ID | Task | Status |
|---|---|---|
| P3-1 | GitHub repo (TON AI สร้าง) + push + Draft PR | ⏸ |
| P3-2 | Vercel project + env vars | ⬜ |
| P3-3 | Supabase Auth redirect URLs + email templates (ภาษาไทย) | ⬜ |
| P3-4 | ทดสอบบน iPhone/Android จริง: ติดตั้ง PWA, offline, กล้อง | ⬜ |

## P4 — Post-handover
| ID | Task | Status |
|---|---|---|
| P4-1 | ใบแจ้งเก็บงาน (PDF) เฉพาะ defect ค้าง สำหรับยื่นภายใน 15 วัน | ⬜ |
| P4-2 | Re-inspection round view + เทียบรูป Before/After | ⬜ |
| P4-3 | Playwright E2E (flow ตรวจ → defect → report, offline) | ⬜ |
| P4-4 | Checklist template library (copy จากบ้านอื่น / import Excel) | ⬜ |
| P4-5 | CI GitHub Actions | ⬜ |

---

## Decisions Log
| วันที่ | Decision | โดย |
|---|---|---|
| 14 Nov | วางแผนก่อนเขียนโค้ด, ทำทีละขั้นและรออนุมัติทุกครั้ง | TON AI |
| 14 Nov | ใช้วันโอนจริงที่ผู้ใช้กรอกเท่านั้นในการคำนวณ deadline | Master Prompt |
| 14 Nov | Phase 1 = App + Auth + Migrations + RLS + Dashboard + Project/Property/Checklist | TON AI |

## Open Items (รอ TON AI)
1. Master Prompt ส่วนที่เหลือ (หลัง Module 5)
2. อนุมัติ Architecture / Schema / Phases
3. ชื่อ GitHub repo
4. อนุมัติสร้าง Supabase project
5. ผังห้อง TH99B จริง (ถ้ามี)

---

## Phase 2 — Inspection Engine (14 Nov 2026)
| ID | Task | Status |
|---|---|---|
| P2-1 | Room Management: /rooms (เพิ่ม/แก้ชื่อ/ลบ/เรียง/คัดลอกหัวข้อไปห้องอื่น), Dexie v2 + migrate ตำแหน่งเดิมเป็นห้อง | ✅ |
| P2-2 | Dynamic Checklist: ห้อง (room_id) + ประเภทการตรวจ ทั่วไป/วิศวกรรม, กรองตามห้อง | ✅ |
| P2-3 | Camera Upload: กล้อง/แกลเลอรี, บีบอัด 1600px, เก็บ IndexedDB พร้อม outbox ในธุรกรรมเดียว, upload Storage ก่อน push | ✅ |
| P2-4 | Defect Management: /defects (แท็บ/กรอง/ค้นหา), /defect (สถานะ, ประวัติ, รูปก่อน-หลัง, แก้ไข/ลบ) | ✅ |
| P2-5 | Severity: แนะนำแบบ rule-based (ไม่ใช่ AI) แก้ไขได้ + flag ให้วิศวกรตรวจ + disclaimer | ✅ |
| P2-6 | Reinspection: FIXED → VERIFIED / REOPENED (ต้องมีเหตุผล), หัวข้อตรวจ sync สถานะอัตโนมัติ | ✅ |
| P2-7 | Tests: unit 53 · E2E 22 (mobile+desktop) รวม workflow พบปัญหา→ปิดงาน และถ่ายรูปออฟไลน์ · RLS 59 | ✅ |
| P2-8 | Apply migration 0004 บน Supabase (ยังรอการอนุมัติ/ยืนยัน) | ⏸ |
