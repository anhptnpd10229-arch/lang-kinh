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
  /**
   * Effect tự vẽ cả cảnh (kể cả video) và tự xử lý lật gương; Player không lật khung bằng CSS.
   * Dùng khi cảnh có chữ hoặc bố cục không được phép bị lật.
   */
  selfMirror?: boolean;
};

/** Props mọi component effect nhận được. Đọc `hub.results` trong `useFrame`, không lưu vào state React. */
export type EffectProps = {
  hub: TrackerHub;
  quality: Quality;
  /** Video camera (chưa lật gương), để effect dùng làm texture hoặc chụp khung hình cục bộ. */
  video: HTMLVideoElement;
  /** Hiện một thông báo ngắn trên thanh điều khiển (vd: cử chỉ vừa kích hoạt). Chỉ gọi khi có sự kiện, không gọi mỗi khung hình. */
  notify?: (message: string) => void;
};
