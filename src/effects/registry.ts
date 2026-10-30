// Danh mục tác phẩm. Thêm tác phẩm mới: tạo thư mục src/effects/<slug>/ với meta.ts + Effect.tsx,
// thêm meta vào EFFECTS bên dưới và thêm loader trong loaders.ts.
import { meta as aether } from "./aether/meta";
import { meta as chienBinh } from "./chien-binh/meta";
import { meta as netVeKhongTrung } from "./net-ve-khong-trung/meta";
import { meta as tiemGiat } from "./tiem-giat/meta";
import type { EffectMeta } from "./types";

const SOON: EffectMeta[] = [
  {
    slug: "ban-tay-hat",
    title: "Bàn Tay Hạt",
    tagline: "Nắm tay để hút, xoè tay để thả hàng nghìn hạt sáng.",
    description: "Hai bàn tay trở thành trường lực điều khiển một đám mây hạt.",
    tags: ["hand"],
    trackers: ["hand"],
    howTo: ["Nắm tay để hút hạt", "Xoè tay để làm hạt bung ra", "Chụm ngón cái và ngón trỏ để vẽ vệt sáng"],
    weight: "vừa",
    facing: "user",
    accent: "#7cf7ff",
    status: "soon",
    year: 2026,
  },
  {
    slug: "dong-chay-co-the",
    title: "Dòng Chảy Cơ Thể",
    tagline: "Chuyển động của bạn để lại dòng màu trên hình ảnh.",
    description: "Tốc độ các khớp cơ thể biến thành trường dòng chảy làm méo và nhuộm khung hình.",
    tags: ["body"],
    trackers: ["pose"],
    howTo: ["Lùi ra để thấy cả người", "Vẫy tay hoặc nhảy để tạo dòng màu", "Đứng yên để màu tan dần"],
    weight: "nặng",
    facing: "user",
    accent: "#ff6b3d",
    status: "soon",
    year: 2026,
  },
  {
    slug: "khach-la",
    title: "Khách Lạ",
    tagline: "Những vị khách ảo lẩn sau và né tránh bóng hình bạn.",
    description: "Vật thể 3D trôi trong khung hình, va chạm và nấp sau dáng người.",
    tags: ["world", "body"],
    trackers: ["segmentation"],
    howTo: ["Đứng trước camera", "Di chuyển để đẩy vật thể", "Đưa tay che để chúng nấp sau bạn"],
    weight: "nặng",
    facing: "user",
    accent: "#b18cff",
    status: "soon",
    year: 2026,
  },
  {
    slug: "du-anh",
    title: "Dư Ảnh",
    tagline: "Mỗi lát cắt của khung hình sống ở một thời điểm khác nhau.",
    description: "Bộ đệm thời gian kéo giãn hiện tại thành quá khứ; bàn tay điều khiển lát cắt thời gian.",
    tags: ["signature", "hand", "body"],
    trackers: ["hand", "segmentation"],
    howTo: ["Di chuyển chậm để thấy dư ảnh", "Đưa tay lên xuống để đổi hướng thời gian"],
    weight: "nặng",
    facing: "user",
    accent: "#c9b9ff",
    status: "soon",
    year: 2026,
  },
];

export const EFFECTS: EffectMeta[] = [aether, chienBinh, netVeKhongTrung, tiemGiat, ...SOON];

export const READY_EFFECTS = EFFECTS.filter((e) => e.status === "ready");

export function getEffect(slug: string): EffectMeta | undefined {
  return EFFECTS.find((e) => e.slug === slug);
}
