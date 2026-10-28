import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin", "vietnamese"], variable: "--font-display", weight: ["500", "700"] });
const body = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], variable: "--font-body", weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Lăng Kính — nghệ thuật camera tương tác", template: "%s · Lăng Kính" },
  description: "Những tác phẩm kỹ thuật số phản ứng với khuôn mặt, bàn tay và cơ thể bạn, ngay trên trình duyệt.",
};

export const viewport: Viewport = { themeColor: "#0b0b0c", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="logo">Lăng Kính</Link>
          <nav>
            <Link href="/works/">Tác phẩm</Link>
            <Link href="/privacy/">Quyền riêng tư</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
