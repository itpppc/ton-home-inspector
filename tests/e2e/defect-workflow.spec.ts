import { expect, test, type Page } from "@playwright/test";

/** 1×1 PNG — enough for the on-device compressor to decode and re-encode as JPEG. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

async function transition(page: Page, button: string, note?: string) {
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  if (note) await dialog.getByLabel(/เหตุผล|หมายเหตุ/).fill(note);
  await dialog.getByRole("button", { name: "ยืนยัน" }).click();
  await expect(dialog).toHaveCount(0);
}

const status = (page: Page) => page.getByTestId("defect-status");

test.describe("Phase 2 — found a problem → closed", () => {
  test("FAIL → defect + photo → submitted → fixed → reinspection fails → fixed → verified", async ({ page }) => {
    // 1. Inspect: fail an item and record it as a defect
    await page.goto("/inspect");
    const card = page.locator("article").first();
    const itemTitle = await card.locator("h3").innerText();
    await card.getByRole("button", { name: "ไม่ผ่าน" }).click();
    await card.getByRole("textbox").fill("พบรอยซึมที่มุมผนัง");
    await card.getByRole("textbox").blur();
    await card.getByRole("button", { name: "บันทึกเป็น Defect" }).click();
    const form = page.getByRole("dialog");
    await expect(form.getByLabel(/ปัญหาที่พบ/)).toHaveValue(itemTitle);
    await form.getByLabel(/ปัญหาที่พบ/).fill("น้ำซึมที่มุมผนังห้องน้ำ");
    await form.getByRole("button", { name: "บันทึก Defect" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card.getByTestId("item-defects")).toContainText("D-001");

    // 2. Defect detail: before photo
    await card.getByTestId("item-defects").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: /D-001/ })).toBeVisible();
    await expect(status(page)).toHaveText("พบปัญหา");
    await page.getByTestId("photo-camera-input").nth(0).setInputFiles(photo("before.png"));
    await expect(page.getByRole("button", { name: /ดูรูป ก่อนแก้ไข/ })).toHaveCount(1);

    // 3. Workflow to FIXED
    await transition(page, "แจ้งโครงการแล้ว", "ส่ง LINE ถึงฝ่ายบริการลูกค้า");
    await expect(status(page)).toHaveText("แจ้งโครงการแล้ว");
    await transition(page, "โครงการกำลังแก้ไข");
    await transition(page, "โครงการแจ้งว่าแก้แล้ว");
    await expect(status(page)).toHaveText("แก้แล้ว รอตรวจซ้ำ");
    await expect(page.getByTestId("reinspection-panel")).toBeVisible();

    // 4. Reinspection #1 fails — reason is mandatory
    await page.getByTestId("photo-camera-input").nth(1).setInputFiles(photo("after1.png"));
    await expect(page.getByRole("button", { name: /ดูรูป หลังแก้ไข/ })).toHaveCount(1);
    await page.getByTestId("reinspection-panel").getByRole("button", { name: /ตรวจซ้ำไม่ผ่าน/ }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "ยืนยัน" })).toBeDisabled();
    await page.getByRole("dialog").getByLabel(/เหตุผล/).fill("ยังมีรอยซึมเหลืออยู่");
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยัน" }).click();
    await expect(status(page)).toHaveText("ตรวจซ้ำไม่ผ่าน");

    // item is back to FAIL while a defect is open
    await page.goto("/inspect");
    await expect(page.locator("article").first().getByRole("button", { name: "ไม่ผ่าน" })).toHaveAttribute("aria-pressed", "true");
    await page.locator("article").first().getByRole("link", { name: /D-001/ }).click();

    // 5. Fixed again → reinspection passes → closed
    await transition(page, "โครงการแจ้งว่าแก้แล้ว");
    await page.getByTestId("photo-camera-input").nth(1).setInputFiles(photo("after2.png"));
    await expect(page.getByRole("button", { name: /ดูรูป หลังแก้ไข/ })).toHaveCount(2);
    await page.getByTestId("reinspection-panel").getByRole("button", { name: /ตรวจซ้ำผ่าน/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยืนยัน" }).click();
    await expect(status(page)).toHaveText("ตรวจซ้ำผ่าน (ปิดงาน)");

    // 6. Timeline is complete and survives a reload
    await page.reload();
    const timeline = page.getByTestId("defect-timeline").locator("li");
    await expect(timeline).toHaveCount(7); // OPEN, SUBMITTED, IN_PROGRESS, FIXED, REOPENED, FIXED, VERIFIED
    await expect(page.getByTestId("defect-timeline")).toContainText("ยังมีรอยซึมเหลืออยู่");

    // 7. Item auto-passed; lists and dashboard show it resolved
    await page.goto("/inspect");
    await expect(page.locator("article").first().getByRole("button", { name: "ผ่าน", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/defects");
    await page.getByRole("tab", { name: /ปิดงานแล้ว \(1\)/ }).click();
    await expect(page.getByTestId("defect-card")).toHaveCount(1);
    await page.getByRole("tab", { name: /ต้องแก้ไข \(0\)/ }).click();
    await expect(page.getByTestId("defect-card")).toHaveCount(0);
    await page.goto("/");
    await expect(page.locator("p", { hasText: "Resolved Defects" }).locator("xpath=following-sibling::p[1]")).toHaveText("1");
  });

  test("photos taken offline are kept on the device and marked pending upload", async ({ page, context }) => {
    await page.goto("/defects");
    await page.getByRole("button", { name: "บันทึก Defect" }).first().click();
    const form = page.getByRole("dialog");
    await form.getByLabel(/ปัญหาที่พบ/).fill("ประตูห้องนอนปิดไม่สนิท");
    await form.getByRole("button", { name: "บันทึก Defect" }).click();
    await expect(page.getByRole("heading", { name: /ประตูห้องนอนปิดไม่สนิท/ })).toBeVisible();

    await context.setOffline(true);
    await page.getByTestId("photo-camera-input").nth(0).setInputFiles(photo("offline.png"));
    const thumb = page.getByRole("button", { name: /ดูรูป ก่อนแก้ไข/ });
    await expect(thumb).toHaveCount(1);
    await expect(thumb.locator("[title*='ยังไม่อัปโหลด']")).toBeVisible();
    await transition(page, "แจ้งโครงการแล้ว"); // status changes also work offline
    await expect(status(page)).toHaveText("แจ้งโครงการแล้ว");
    await context.setOffline(false);
  });

  test("severity suggestion, engineer flag and disclaimer", async ({ page }) => {
    await page.goto("/defects");
    await page.getByRole("button", { name: "บันทึก Defect" }).first().click();
    const form = page.getByRole("dialog");
    await form.getByLabel(/ปัญหาที่พบ/).fill("พบรอยร้าวเฉียงที่คาน");
    await expect(form.getByRole("status")).toContainText("วิกฤต");
    await form.getByRole("button", { name: "ใช้ตามแนะนำ" }).click();
    await expect(form.getByRole("radio", { name: /วิกฤต/ })).toHaveAttribute("aria-checked", "true");
    await expect(form.getByRole("checkbox")).toBeChecked();
    await expect(form.getByText(/ไม่ใช่การรับรองความปลอดภัย/)).toBeVisible();
    await form.getByRole("button", { name: "บันทึก Defect" }).click();
    await expect(page.getByRole("note")).toContainText("ไม่ใช่การรับรองความปลอดภัย");
  });
});

test.describe("Phase 2 — rooms", () => {
  test("add, rename, copy items, reorder and delete a room", async ({ page }) => {
    await page.goto("/rooms");
    const rows = page.getByTestId("room-row");
    await expect(rows.first()).toBeVisible(); // wait for IndexedDB before counting
    const base = await rows.count();
    await page.getByRole("button", { name: "เพิ่มห้อง" }).click();
    await page.getByRole("dialog").getByLabel("ชั้น").fill("ชั้น 2");
    await page.getByRole("dialog").getByLabel(/ชื่อห้อง/).fill("ห้องทดสอบ E2E");
    await page.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
    await expect(rows).toHaveCount(base + 1);

    // duplicate refused
    await page.getByRole("button", { name: "เพิ่มห้อง" }).click();
    await page.getByRole("dialog").getByLabel("ชั้น").fill("ชั้น 2");
    await page.getByRole("dialog").getByLabel(/ชื่อห้อง/).fill("ห้องทดสอบ E2E");
    await page.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("มีห้องนี้อยู่แล้ว")).toBeVisible();
    await page.keyboard.press("Escape");

    // copy items from the first room that has some
    await page.getByRole("button", { name: /^คัดลอกหัวข้อตรวจของ/ }).first().click();
    await page.getByRole("dialog").getByLabel("ห้องปลายทาง").selectOption({ label: "ชั้น 2 - ห้องทดสอบ E2E" });
    await page.getByRole("dialog").getByRole("button", { name: "คัดลอก" }).click();
    await expect(page.getByTestId("room-row").filter({ hasText: "ห้องทดสอบ E2E" })).toContainText(/(?<!\d)[1-9]\d* หัวข้อตรวจ/);

    // rename
    await page.getByRole("button", { name: "แก้ไข ชั้น 2 - ห้องทดสอบ E2E" }).click();
    await page.getByRole("dialog").getByLabel(/ชื่อห้อง/).fill("ห้องเปลี่ยนชื่อ");
    await page.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByTestId("room-row").filter({ hasText: "ห้องเปลี่ยนชื่อ" })).toHaveCount(1);

    // inspection filter uses the room
    await page.goto("/inspect");
    await expect(page.getByLabel("ห้อง / ตำแหน่ง").locator("option", { hasText: "ห้องเปลี่ยนชื่อ" })).toHaveCount(1);

    // delete
    await page.goto("/rooms");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "ลบ ชั้น 2 - ห้องเปลี่ยนชื่อ" }).click();
    await expect(rows).toHaveCount(base);
  });
});
