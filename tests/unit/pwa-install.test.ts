import { describe, expect, it } from "vitest";
import { detectEnv } from "@/features/pwa/install-state";

const env = (ua: string, maxTouchPoints = 0) => detectEnv(ua, { standalone: false, maxTouchPoints });

describe("detectEnv — install guidance per OS/browser", () => {
  it("iPhone Safari", () => {
    expect(env("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toEqual({ platform: "ios", browser: "safari", standalone: false });
  });
  it("iPhone Chrome (CriOS)", () => {
    expect(env("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1").browser).toBe("chromium");
  });
  it("iPadOS reporting desktop Safari", () => {
    expect(env("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", 5).platform).toBe("ios");
  });
  it("Mac Safari stays desktop", () => {
    expect(env("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", 0).platform).toBe("desktop");
  });
  it("Android Chrome", () => {
    expect(env("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toEqual({ platform: "android", browser: "chromium", standalone: false });
  });
  it("Samsung Internet", () => {
    expect(env("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36").browser).toBe("samsung");
  });
  it("LINE in-app browser (iOS and Android)", () => {
    expect(env("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.20.0").browser).toBe("in-app");
    expect(env("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 Line/14.20.0").browser).toBe("in-app");
  });
  it("Facebook in-app browser", () => {
    expect(env("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]").browser).toBe("in-app");
  });
  it("Desktop Edge", () => {
    expect(env("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toEqual({ platform: "desktop", browser: "chromium", standalone: false });
  });
});
