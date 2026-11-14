import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixture = (f: string) => join(__dirname, "..", "fixtures", f);
const hasFfmpeg = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();

async function openHouse(page: import("@playwright/test").Page) {
  await page.goto("/projects");
  await page.getByRole("link", { name: /TH99B/ }).first().click();
  await expect(page.getByText("รูปบ้าน & ผังบ้าน")).toBeVisible();
}

test.describe("short video evidence", () => {
  test("small clip is kept as-is, plays in the viewer and shows as a tile in the report", async ({ page }) => {
    await openHouse(page);
    await page.getByTestId("photo-gallery-input").setInputFiles(fixture("short.webm"));
    await expect(page.getByText("บันทึกวิดีโอ 1 คลิปในเครื่องแล้ว")).toBeVisible();
    const tile = page.getByRole("button", { name: /ดูวิดีโอ รูปบ้าน/ });
    await expect(tile).toContainText("0:02");
    await tile.click();
    const player = page.getByRole("dialog").locator("video");
    await expect(player).toHaveAttribute("controls", "");
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    await page.goto("/reports");
    await expect(page.locator("#report-print").getByText(/▶ วิดีโอ 0:02/)).toBeVisible();
  });

  test("clips longer than 30 seconds are refused with a clear message", async ({ page }) => {
    await openHouse(page);
    await page.getByTestId("photo-gallery-input").setInputFiles(fixture("too-long.webm"));
    await expect(page.getByText(/เกิน 30 วินาที/)).toBeVisible();
    await expect(page.getByRole("button", { name: /ดูวิดีโอ/ })).toHaveCount(0);
  });

  test("a large 1080p clip is shrunk on-device before saving", async ({ page }) => {
    test.skip(!hasFfmpeg, "needs ffmpeg to generate a large clip");
    test.setTimeout(60_000);
    const big = join(mkdtempSync(join(tmpdir(), "ton-vid-")), "big.webm");
    if (!existsSync(big))
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30,noise=alls=40:allf=t", "-t", "4", "-c:v", "libvpx", "-b:v", "14M", "-deadline", "realtime", "-cpu-used", "8", big]);
    await openHouse(page);
    await page.getByTestId("photo-gallery-input").setInputFiles(big);
    await expect(page.getByText(/ย่อวิดีโอจาก .* MB เหลือ/)).toBeVisible({ timeout: 45_000 });
    const saved = await page.evaluate(async () => {
      const req = indexedDB.open("ton-home-inspector");
      const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
      const rows: { media_type?: string; width: number; height: number; storage_path: string }[] = await new Promise((r) => {
        const q = db.transaction("photos").objectStore("photos").getAll();
        q.onsuccess = () => r(q.result);
      });
      return rows.filter((p) => p.media_type === "video");
    });
    expect(saved).toHaveLength(1);
    expect(Math.min(saved[0].width, saved[0].height)).toBeLessThanOrEqual(720);
    expect(saved[0].storage_path).toMatch(/\.(mp4|webm)$/);
  });
});
