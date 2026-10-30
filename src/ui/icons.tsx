// Icon nét SVG dùng chung cho giao diện (trang trí, nên aria-hidden).
import type { SVGProps } from "react";

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

type IconProps = { size?: number; className?: string };

export const CameraIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M15 10l5-3v10l-5-3" />
    <rect x="3" y="6" width="12" height="12" rx="3" />
  </svg>
);

export const DownloadIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
);

export const GlobeIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </svg>
);

export const LockIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const BackIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

/** Lăng kính: tam giác tách tia, dùng trong cụm hình trang chủ. */
export const PrismIcon = ({ size = 64, className }: IconProps) => (
  <svg {...base(size)} strokeWidth={1.4} className={className}>
    <path d="M12 3l8 15H4z" />
    <path d="M12 3v15" />
    <path d="M20 18l2 2M4 18l-2 2" />
  </svg>
);
