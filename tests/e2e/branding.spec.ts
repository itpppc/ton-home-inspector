import { expect, test } from "@playwright/test";

test.describe("TON AI copyright on every surface", () => {
  test("app footer/sidebar, profile About and the printable report link to ton-ai-tech.web.app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    const credit = page.getByRole("link", { name: /© 25\d\d TON AI SERVICE TECH/ }).filter({ visible: true });
    await expect(credit.first()).toHaveAttribute("href", "https://ton-ai-tech.web.app/");
    expect((await page.request.get("/brand/ton-ai-logo.svg")).ok()).toBe(true);

    await page.goto("/profile");
    await expect(page.getByText("เกี่ยวกับแอป")).toBeVisible();

    await page.goto("/reports");
    const footer = page.locator("#report-print footer");
    await expect(footer).toContainText("TON AI SERVICE TECH");
    await expect(footer.getByRole("link")).toHaveAttribute("href", "https://ton-ai-tech.web.app/");
  });
});

test("admin page is cloud-only and hidden from the menu in local mode", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("ใช้ได้เมื่อเชื่อมต่อ Cloud")).toBeVisible();
  await expect(page.getByRole("link", { name: "ผู้ดูแลระบบ" })).toHaveCount(0);
});
