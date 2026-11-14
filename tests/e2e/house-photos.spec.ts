import { expect, test } from "@playwright/test";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const img = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

test("house page: attach front photo + floor plans from the gallery; they appear on the report cover", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("link", { name: /TH99B/ }).first().click();
  await expect(page.getByText("รูปบ้าน & ผังบ้าน")).toBeVisible();
  await page.getByTestId("photo-gallery-input").setInputFiles([img("front.png"), img("plan-1.png"), img("plan-2.png")]);
  await expect(page.getByText("บันทึกรูป 3 รูปในเครื่องแล้ว")).toBeVisible();
  await expect(page.getByRole("button", { name: /ดูรูป รูปบ้าน \/ ผังบ้าน/ })).toHaveCount(3);

  await page.goto("/reports");
  await expect(page.locator('#report-print [aria-label="รูปบ้าน / ผังบ้าน"] img')).toHaveCount(3);
});
