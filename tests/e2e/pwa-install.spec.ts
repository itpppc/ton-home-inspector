import { expect, test } from "@playwright/test";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const LINE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.20.0";

test.describe("PWA install — every OS", () => {
  test("manifest + service worker satisfy Chromium installability", async ({ page, context, browserName }, info) => {
    test.skip(browserName !== "chromium" || info.project.name !== "desktop", "CDP check once");
    const res = await page.request.get("/manifest.webmanifest");
    const m = await res.json();
    expect(m).toMatchObject({ id: "/", start_url: "/", display: "standalone" });
    expect(m.icons.some((i: { sizes: string; purpose?: string }) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
    for (const icon of m.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
    expect((await page.request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);

    await page.goto("/");
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 30_000 });
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    // Playwright contexts are incognito-like; that is the only error allowed.
    expect(installabilityErrors.filter((e: { errorId: string }) => e.errorId !== "in-incognito")).toEqual([]);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
  });

  test("iPhone Safari: banner opens Add-to-Home-Screen steps; dismiss persists", async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "mobile only");
    const ctx = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "th-TH" });
    const page = await ctx.newPage();
    await page.goto("/");
    const banner = page.getByRole("region", { name: "ติดตั้งแอป" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "ติดตั้ง" }).click();
    const dialog = page.getByRole("dialog", { name: "ติดตั้ง TON Home Inspector" });
    await expect(dialog.getByText("เพิ่มไปยังหน้าจอโฮม")).toBeVisible();
    await dialog.getByRole("button", { name: "ปิด" }).click();
    await banner.getByRole("button", { name: /ไม่ต้องแสดงอีก/ }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "ภาพรวมงานตรวจ" })).toBeVisible();
    await expect(page.getByRole("region", { name: "ติดตั้งแอป" })).toBeHidden();
    // Still reachable from the profile page after dismissing the banner.
    await page.goto("/profile");
    await expect(page.getByRole("button", { name: "ติดตั้งแอป" })).toBeVisible();
    await ctx.close();
  });

  test("LINE in-app browser: tells user to open in the real browser", async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "mobile only");
    const ctx = await browser.newContext({ userAgent: LINE_UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "th-TH" });
    const page = await ctx.newPage();
    await page.goto("/profile");
    await page.getByRole("button", { name: "ติดตั้งแอป" }).click();
    const link = page.getByRole("dialog").getByRole("link", { name: "เปิดในเบราว์เซอร์" });
    await expect(link).toHaveAttribute("href", /openExternalBrowser=1/);
    await ctx.close();
  });

  test("installed (standalone) mode hides the banner", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile only");
    await page.addInitScript(() => {
      const orig = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList) : orig(q));
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ภาพรวมงานตรวจ" })).toBeVisible();
    await expect(page.getByRole("region", { name: "ติดตั้งแอป" })).toHaveCount(0);
  });
});
