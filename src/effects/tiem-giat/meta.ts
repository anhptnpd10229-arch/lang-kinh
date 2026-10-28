import type { EffectMeta } from "../types";

export const meta: EffectMeta = {
  slug: "tiem-giat",
  title: "Tiệm Giặt",
  tagline: "Chui vào lồng giặt, quay mòng mòng rồi được đem phơi lên dây.",
  description:
    "Một tiệm giặt nhỏ nơi khuôn mặt bạn là mẻ đồ tiếp theo. Lồng giặt bám theo khuôn mặt, nước và bọt dâng lên, quần áo cuộn tròn quanh bạn. Giặt xong, phiên bản \"sạch sẽ\" của bạn được kẹp lên dây phơi — đôi khi bị treo ngược. Ảnh phơi chỉ tồn tại trên máy bạn và biến mất khi thoát.",
  tags: ["face", "body"],
  trackers: ["face", "segmentation"],
  howTo: [
    "Đưa mặt vào giữa ô cửa lồng giặt",
    "Bấm nút GIẶT hoặc há miệng khoảng nửa giây để bắt đầu",
    "Nước dâng từ từ rồi lồng mới quay; giặt, vắt xong bạn được lấy ra giũ cho phẳng rồi phơi lên dây",
    "Bấm DỪNG khi đang giặt để dừng máy, khi máy rảnh để gỡ hết đồ phơi",
  ],
  weight: "vừa",
  facing: "user",
  accent: "#7fd1b9",
  status: "ready",
  year: 2026,
  selfMirror: true,
};
