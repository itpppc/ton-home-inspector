import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ThemeProvider, themeInitScript } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ServiceWorkerRegistrar } from "@/components/app/sw-registrar";
import { earlyInstallCaptureScript } from "@/features/pwa/install-state";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TON Home Inspector", template: "%s · TON Home Inspector" },
  description: "ระบบตรวจรับบ้านและติดตามงานแก้ไข — INSIGHT • AUTOMATE • GROW",
  applicationName: "TON Home Inspector",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "TON Inspector", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#0b1f4b" }, { media: "(prefers-color-scheme: dark)", color: "#071330" }],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: earlyInstallCaptureScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster richColors position="top-center" closeButton />
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
