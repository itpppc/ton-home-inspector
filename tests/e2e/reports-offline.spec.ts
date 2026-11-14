import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

/** Fail the first item, record it as a defect with a Thai title that stacks vowels + tone marks, and add a photo. */
async function recordDefect(page: Page, title: string) {
  await page.goto("/inspect");
  const card = page.locator("article").first();
  await card.getByRole("button", { name: "ไม่ผ่าน" }).click();
  await card.getByRole("button", { name: "บันทึกเป็น Defect" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel(/ปัญหาที่พบ/).fill(title);
  await form.getByRole("button", { name: "บันทึก Defect" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await card.getByTestId("item-defects").getByRole("link").first().click();
  // wait for the defect page: the inspect page's own (item) photo input is still mounted until navigation completes
  await expect(page.getByRole("heading", { name: /D-\d+ ·/ })).toBeVisible();
  await page.getByTestId("photo-camera-input").nth(0).setInputFiles(photo("before.png"));
  await expect(page.getByRole("button", { name: /ดูรูป ก่อนแก้ไข/ })).toHaveCount(1);
}

test.describe("Phase 3 — offline inspection, reports, backup", () => {
  test("inspect offline: result + defect + photo survive reload offline and after coming back online", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    for (const route of ["/inspect", "/defects", "/defect?id=00000000-0000-4000-8000-000000000000", "/reports"]) await page.goto(route); // warm the cache

    await context.setOffline(true);
    await recordDefect(page, "น้ำรั่วซึมที่ผนังห้องน้ำ ก่อนโอน");
    const url = page.url();
    await page.reload(); // reload while offline: shell comes from the service worker, data from IndexedDB
    await expect(page.getByRole("heading", { name: /D-001/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /ดูรูป ก่อนแก้ไข/ })).toHaveCount(1);
    await page.goto("/inspect");
    await expect(page.locator("article").first().getByRole("button", { name: "ไม่ผ่าน" })).toHaveAttribute("aria-pressed", "true");

    await context.setOffline(false);
    await page.goto(url);
    await expect(page.getByRole("heading", { name: /D-001/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /ดูรูป ก่อนแก้ไข/ })).toHaveCount(1);
  });

  test("report preview, Thai PDF, Excel download and JSON backup", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "PDF/download checks run once, on desktop");
    await recordDefect(page, "น้ำรั่วซึมที่ผนังห้องน้ำ ก่อนโอนกรรมสิทธิ์");
    await page.goto("/reports");
    const report = page.locator("#report-print");
    await expect(report.getByRole("heading", { name: "รายงานตรวจรับบ้าน" })).toBeVisible();
    await expect(report).toContainText("1240-032002");
    await expect(report).toContainText("น้ำรั่วซึมที่ผนังห้องน้ำ ก่อนโอนกรรมสิทธิ์");
    await expect(report).toContainText("ไม่ใช่การรับรองความปลอดภัย");
    await expect(report.locator("img:not([alt=\"TON AI\"])")).toHaveCount(1); // defect photo (logo excluded)
    await expect(report.locator("footer")).toContainText("TON AI SERVICE TECH");
    await expect(report.locator("[data-photo-loading]")).toHaveCount(0);

    // print view hides the app chrome
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "พิมพ์ / บันทึกเป็น PDF" })).toBeHidden();
    await expect(page.getByRole("banner")).toBeHidden();
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(20_000);
    const fs = await import("node:fs/promises");
    await fs.mkdir("test-results", { recursive: true });
    await fs.writeFile("test-results/report-thai.pdf", pdf);
    await page.emulateMedia({ media: "screen" });

    const [xlsx] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ดาวน์โหลด Excel" }).click()]);
    expect(xlsx.suggestedFilename()).toMatch(/^TON-Report-.*\.xlsx$/);
    const xlsxPath = await xlsx.path();
    expect(readFileSync(xlsxPath!).subarray(0, 2).toString()).toBe("PK"); // zip container

    const [backup] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "สำรองข้อมูล (JSON)" }).click()]);
    const json = JSON.parse(readFileSync((await backup.path())!, "utf8"));
    expect(json).toMatchObject({ app: "ton-home-inspector", version: 1 });
    expect(json.tables.defects).toHaveLength(1);
    expect(json.photos).toHaveLength(1);

    // restore into the same device: nothing is newer in the file, so nothing is overwritten
    await page.getByTestId("restore-input").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(json)) });
    await expect(page.getByText(/กู้คืนแล้ว 0 รายการ/)).toBeVisible();
    await expect(page.getByText(/ข้าม \d+ รายการที่ใหม่กว่าอยู่แล้ว/)).toBeVisible();
  });
});
