import { expect, test } from "@playwright/test";

/** Local mode (no Supabase env): full flow on seeded data. */
test.describe("Phase 1 — local mode", () => {
  test("seeds default data and shows dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ภาพรวมงานตรวจ" })).toBeVisible();
    await expect(page.locator("main").getByText(/Siri Place Rama 2 · แปลง 1240-032002 · TH99B/)).toBeVisible();
    await expect(page.getByText("ยังไม่ได้บันทึกวันโอนกรรมสิทธิ์จริง").first()).toBeVisible();
    await expect(page.getByTestId("checked-summary")).toHaveText(/ตรวจแล้ว 0 \/ \d+ ข้อ/);
  });

  test("inspect: PASS/FAIL updates progress and persists after reload", async ({ page }) => {
    await page.goto("/inspect");
    const first = page.locator("article").first();
    await first.getByRole("button", { name: "ผ่าน", exact: true }).click();
    await expect(first.getByRole("button", { name: "ผ่าน", exact: true })).toHaveAttribute("aria-pressed", "true");
    const second = page.locator("article").nth(1);
    await second.getByRole("button", { name: "ไม่ผ่าน" }).click();
    await second.getByRole("textbox").fill("รอยร้าวที่มุมวงกบ");
    await second.getByRole("textbox").blur();
    await page.reload();
    await expect(page.locator("article").first().getByRole("button", { name: "ผ่าน", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("article").nth(1).getByRole("textbox")).toHaveValue("รอยร้าวที่มุมวงกบ");
    await page.goto("/");
    await expect(page.getByTestId("checked-summary")).toHaveText(/ตรวจแล้ว 2 \/ \d+ ข้อ/);
  });

  test("property: actual transfer date drives the 15-day deadline", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("link", { name: /บ้านแปลง 1240-032002/ }).click();
    await expect(page.getByLabel("เลขแปลง (Plot Number)")).toHaveValue("1240-032002");
    await page.getByLabel("วันจดทะเบียนโอนจริง").fill("2026-11-18");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText(/ยื่นแจ้งเก็บงานได้ถึง|ยื่นได้ถึง|เหลือ \d+ วัน|วันสุดท้าย|หมดระยะ/).first()).toBeVisible();
    await expect(page.getByText(/3 ธ\.ค\. 2569/).first()).toBeVisible();
  });

  test("checklist: add category and item, then delete item", async ({ page }) => {
    await page.goto("/checklist");
    await page.getByLabel("ชื่อหมวดใหม่").fill("งานทดสอบ E2E");
    await page.getByRole("button", { name: "เพิ่มหมวด" }).click();
    const card = page.locator("[data-slot=card]", { has: page.getByRole("heading", { name: /งานทดสอบ E2E/ }) });
    await card.getByRole("button", { name: "หัวข้อ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("หัวข้อที่ตรวจ").fill("ทดสอบระบบกริ่งไร้สาย");
    await dialog.getByLabel("ห้อง / ตำแหน่ง").selectOption({ index: 1 });
    await dialog.getByRole("button", { name: "บันทึก" }).click();
    await expect(card.getByText("ทดสอบระบบกริ่งไร้สาย")).toBeVisible();
    page.once("dialog", (d) => void d.accept());
    await card.getByRole("button", { name: "ลบ", exact: true }).click();
    await expect(card.getByText("ทดสอบระบบกริ่งไร้สาย")).toHaveCount(0);
  });

  test("projects: create a project and a property with template", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: "สร้างโครงการ" }).first().click();
    await page.getByRole("dialog").getByLabel("ชื่อโครงการ").fill("โครงการทดสอบ");
    await page.getByRole("dialog").getByRole("button", { name: "สร้างโครงการ" }).click();
    await expect(page.getByRole("heading", { name: "โครงการทดสอบ" })).toBeVisible();
    await page.getByRole("button", { name: "เพิ่มบ้าน" }).click();
    await page.getByRole("dialog").getByLabel("ชื่อบ้าน (Property Name)").fill("บ้านทดสอบ A");
    await page.getByRole("dialog").getByRole("button", { name: "เพิ่มบ้าน" }).click();
    await expect(page.getByRole("heading", { name: "บ้านทดสอบ A" })).toBeVisible();
    await expect(page.getByText(/\d{3} รายการ · ตรวจแล้ว 0/)).toBeVisible();
  });

  test("validation: rejects empty project name", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: "สร้างโครงการ" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "สร้างโครงการ" }).click();
    await expect(page.getByText("กรุณาระบุชื่อโครงการ")).toBeVisible();
  });

  test("offline: app shell and data load without network", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // let SW control the page
    await page.goto("/inspect");
    await expect(page.locator("article").first()).toBeVisible();
    await context.setOffline(true);
    await page.goto("/property?id=00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("ไม่พบบ้านหลังนี้")).toBeVisible();
    await page.goto("/inspect");
    await page.locator("article").nth(2).getByRole("button", { name: "N/A" }).click();
    await expect(page.locator("article").nth(2).getByRole("button", { name: "N/A" })).toHaveAttribute("aria-pressed", "true");
    await context.setOffline(false);
  });
});
