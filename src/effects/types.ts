import type { Quality } from "@/core/perf";
import type { TrackerHub, TrackerKind } from "@/core/tracker-hub";

export type EffectTag = "face" | "hand" | "body" | "world" | "signature";

export const TAG_LABEL: Record<EffectTag, string> = {
  face: "Khuôn mặt",
  hand: "Bàn tay",
  body: "Cơ thể",
  world: "Không gian",
  signature: "Chủ lực",
};

/** Metadata của một tác phẩm. Chỉ chứa dữ liệu tĩnh, an toàn để import ở trang server. */
export type EffectMeta = {
  slug: string;
  title: string;
  /** Một câu cho thẻ thư viện và mô tả chia sẻ. */
  tagline: string;
  /** Đoạn mô tả nghệ thuật cho trang tác phẩm. */
  description: string;
  tags: EffectTag[];
  trackers: TrackerKind[];
  /** Cách tương tác, mỗi mục một câu ngắn. */
  howTo: string[];
  weight: "nhẹ" | "vừa" | "nặng";
  facing: "user" | "environment";
  /** Màu nhấn cho thẻ/ảnh đại diện tạm thời khi chưa có video preview. */
  accent: string;
  status: "ready" | "soon";
  year: number;
};

/** Props mọi component effect nhận được. Đọc `hub.results` trong `useFrame`, không lưu vào state React. */
export type EffectProps = {
  hub: TrackerHub;
  quality: Quality;
  /** Hiện một thông báo ngắn trên thanh điều khiển (vd: cử chỉ vừa kích hoạt). Chỉ gọi khi có sự kiện, không gọi mỗi khung hình. */
  notify?: (message: string) => void;
};
