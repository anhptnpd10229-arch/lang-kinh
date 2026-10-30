"use client";

// Thanh điều hướng dính đỉnh trang: viên thuốc kính mờ, mục đang mở tô lavender.
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/works/", label: "Tác phẩm", short: "Tác phẩm" },
  { href: "/privacy/", label: "Quyền riêng tư", short: "Riêng tư" },
];

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <div className="site-header">
      <header className="site-header-bar">
        <Link href="/" className="logo">
          <span className="logo-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Lăng Kính
        </Link>
        <nav className="site-nav" aria-label="Điều hướng chính">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? "page" : undefined}>
              <span className="label-long">{item.label}</span>
              <span className="label-short">{item.short}</span>
            </Link>
          ))}
        </nav>
      </header>
    </div>
  );
}
