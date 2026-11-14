import { expect, test } from "@playwright/test";

test.describe("email link routes", () => {
  test("broken or forged confirm links land on login, never off-site", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=x&type=sms&next=https://evil.example");
    await expect(page).toHaveURL(/\/login\?error=link$/);
    await page.goto("/auth/callback?next=//evil.example");
    await expect(page).toHaveURL(/\/login\?error=link$/);
  });
});
