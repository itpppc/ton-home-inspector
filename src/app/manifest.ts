import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TON Home Inspector",
    short_name: "TON Inspector",
    description: "ระบบตรวจรับบ้านและติดตามงานแก้ไข",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    display_override: ["standalone", "minimal-ui"],
    categories: ["productivity", "utilities"],
    prefer_related_applications: false,
    background_color: "#f4f6fa",
    theme_color: "#0b1f4b",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "ตรวจบ้าน", short_name: "ตรวจบ้าน", url: "/inspect", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "รายการ Defect", short_name: "Defect", url: "/defects", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
