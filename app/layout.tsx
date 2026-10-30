import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Lexend } from "next/font/google";
import SiteHeader from "@/ui/SiteHeader";
import "./globals.css";

const display = Lexend({ subsets: ["latin", "vietnamese"], variable: "--font-display", weight: ["500", "600", "700"] });
const body = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], variable: "--font-body", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Lăng Kính — nghệ thuật camera tương tác", template: "%s · Lăng Kính" },
  description: "Những tác phẩm kỹ thuật số phản ứng với khuôn mặt, bàn tay và cơ thể bạn, ngay trên trình duyệt.",
};

export const viewport: Viewport = { themeColor: "#fffbf5", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${display.variable} ${body.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
