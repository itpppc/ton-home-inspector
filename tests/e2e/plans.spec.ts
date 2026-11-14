import { expect, test } from "@playwright/test";

test("plans page lists Free / Pro / Business; local mode is unlimited and never blocks creation", async ({ page }) => {
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "แพ็กเกจสมาชิก" })).toBeVisible();
  for (const name of ["Free", "Pro", "Business"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("ใช้งานได้ไม่จำกัด")).toBeVisible();
  await expect(page.getByRole("link", { name: /ติดต่ออัปเกรด/ }).first()).toHaveAttribute("href", "https://ton-ai-tech.web.app/");

  // The seeded project already exists; a second one must still be allowed locally (no upgrade dialog).
  await page.goto("/projects");
  await page.getByRole("button", { name: "สร้างโครงการ" }).first().click();
  await expect(page.getByRole("dialog", { name: "สร้างโครงการใหม่" })).toBeVisible();
  await expect(page.getByText("เกินสิทธิ์แพ็กเกจปัจจุบัน")).toHaveCount(0);
});
