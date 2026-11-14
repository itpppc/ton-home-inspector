import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { baseMime, extensionFor, formatDuration, isVideoMime, planVideo, targetSize, VIDEO_KEEP_BYTES, VIDEO_MAX_BYTES } from "@/lib/media/policy";
import { InspectorDB, getDB, setDB } from "@/lib/db/local";
import { savePhoto } from "@/lib/db/photos";

const MB = 1024 * 1024;

describe("video policy", () => {
  it("rejects long or unreadable clips", () => {
    expect(planVideo({ bytes: MB, durationSec: 45, height: 720, type: "video/mp4" })).toMatchObject({ action: "reject", reason: expect.stringMatching(/45 วินาที/) });
    expect(planVideo({ bytes: MB, durationSec: Infinity, height: 720, type: "video/mp4" }).action).toBe("reject");
    expect(planVideo({ bytes: MB, durationSec: 30.3, height: 720, type: "video/mp4" }).action).not.toBe("reject");
  });
  it("keeps small clips, compresses big or high-resolution ones", () => {
    expect(planVideo({ bytes: VIDEO_KEEP_BYTES, durationSec: 10, height: 720, type: "video/quicktime" })).toEqual({ action: "keep" });
    expect(planVideo({ bytes: 2 * MB, durationSec: 10, height: 2160, type: "video/mp4" })).toEqual({ action: "compress", fallbackKeep: true });
    expect(planVideo({ bytes: 40 * MB, durationSec: 20, height: 1080, type: "video/mp4" })).toEqual({ action: "compress", fallbackKeep: false });
    expect(planVideo({ bytes: MB, durationSec: 5, height: 480, type: "video/x-matroska" })).toEqual({ action: "compress", fallbackKeep: false });
    expect(VIDEO_MAX_BYTES).toBeLessThan(15 * MB); // server bucket limit (migration 0009)
  });
  it("downscales to 720p short side with even dimensions", () => {
    expect(targetSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(targetSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(targetSize(640, 360)).toEqual({ width: 640, height: 360 });
    expect(targetSize(1001, 1777).width % 2).toBe(0);
  });
  it("maps mime types to storage extensions", () => {
    expect(baseMime("video/webm;codecs=vp9,opus")).toBe("video/webm");
    expect(isVideoMime("video/quicktime")).toBe(true);
    expect(isVideoMime("image/jpeg")).toBe(false);
    expect(extensionFor("video/quicktime")).toBe("mov");
    expect(extensionFor("video/webm;codecs=vp8")).toBe("webm");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(formatDuration(65.4)).toBe("1:05");
    expect(formatDuration(null)).toBe("");
  });
});

let n = 0;
beforeEach(() => setDB(new InspectorDB(`media-${++n}`)));
const vid = () => new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" });
const img = () => new Blob([new Uint8Array([1])], { type: "image/jpeg" });

describe("media rows", () => {
  it("videos carry media_type + duration and a matching extension; images omit the new columns", async () => {
    const v = await savePhoto({ target: { project_id: "p", property_id: "h", item_id: "i" }, kind: "ITEM", blob: vid(), width: 1280, height: 720, durationSec: 12.345 });
    expect(await getDB().photos.get(v.id)).toMatchObject({ media_type: "video", duration_sec: 12.3, storage_path: `p/${v.id}.mp4` });
    const i = await savePhoto({ target: { project_id: "p", property_id: "h", item_id: "i" }, kind: "ITEM", blob: img(), width: 1, height: 1 });
    const row = await getDB().photos.get(i.id);
    expect(row).not.toHaveProperty("media_type");
    expect(row!.storage_path).toBe(`p/${i.id}.jpg`);
  });
  it("project-level media has no house; other kinds need one", async () => {
    const p = await savePhoto({ target: { project_id: "p" }, kind: "PROJECT", blob: img(), width: 1, height: 1 });
    expect(await getDB().photos.get(p.id)).toMatchObject({ property_id: null, kind: "PROJECT" });
    await expect(savePhoto({ target: { project_id: "p", property_id: "h" }, kind: "PROJECT", blob: img(), width: 1, height: 1 })).rejects.toThrow();
    await expect(savePhoto({ target: { project_id: "p" }, kind: "PROPERTY", blob: img(), width: 1, height: 1 })).rejects.toThrow();
  });
});
