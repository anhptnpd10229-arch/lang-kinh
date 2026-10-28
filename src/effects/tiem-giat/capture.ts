// Chụp phần đầu + vai của người dùng thành ảnh cắt rời (nền trong suốt) để phơi lên dây.
// Ảnh chỉ nằm trong bộ nhớ trình duyệt dưới dạng canvas; không lưu, không gửi đi đâu.
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { SegmentationMask } from "@/core/tracker-hub";

export const CUT_W = 256;
export const CUT_H = 288;

/**
 * Cắt vùng quanh khuôn mặt (rộng ra để lấy cả tóc và vai), lật gương như người dùng thấy,
 * rồi dùng mask tách người làm kênh alpha. Không có mask thì cắt theo hình oval.
 */
export type Cutout = {
  canvas: HTMLCanvasElement;
  /** Phần trong suốt phía trên đầu và phía dưới vai, tính theo tỉ lệ chiều cao ảnh; dùng để kẹp sát mép ảnh. */
  padTop: number;
  padBottom: number;
};

export function captureCutout(
  video: HTMLVideoElement,
  face: NormalizedLandmark[],
  mask: SegmentationMask | undefined,
): Cutout {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of face) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const faceH = (maxY - minY) * vh;

  // Khung cắt (pixel video): trên đỉnh đầu một chút, dưới cằm đủ thấy vai.
  const sh = faceH * 2.3;
  const sw = (sh * CUT_W) / CUT_H;
  const sx = ((minX + maxX) / 2) * vw - sw / 2;
  const sy = minY * vh - faceH * 0.55;

  const canvas = document.createElement("canvas");
  canvas.width = CUT_W;
  canvas.height = CUT_H;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.save();
  g.translate(CUT_W, 0);
  g.scale(-1, 1);
  drawClamped(g, video, sx, sy, sw, sh, vw, vh);
  g.restore();

  const img = g.getImageData(0, 0, CUT_W, CUT_H);
  const px = img.data;
  let firstRow = -1;
  let lastRow = -1;
  for (let y = 0; y < CUT_H; y++) {
    let solid = 0;
    for (let x = 0; x < CUT_W; x++) {
      // Toạ độ chuẩn hoá trên video gốc (chưa lật) ứng với điểm ảnh này.
      const u = (sx + ((CUT_W - 1 - x) / CUT_W) * sw) / vw;
      const v = (sy + (y / CUT_H) * sh) / vh;
      let a: number;
      if (mask && u >= 0 && u < 1 && v >= 0 && v < 1) {
        a = mask.data[Math.floor(v * mask.height) * mask.width + Math.floor(u * mask.width)];
        a = smooth(0.35, 0.65, a);
      } else {
        // Dự phòng: oval mềm quanh mặt.
        const dx = (x / CUT_W - 0.5) / 0.42;
        const dy = (y / CUT_H - 0.42) / 0.4;
        a = smooth(1.05, 0.9, Math.hypot(dx, dy));
      }
      px[(y * CUT_W + x) * 4 + 3] *= a;
      if (px[(y * CUT_W + x) * 4 + 3] > 128) solid++;
    }
    // Hàng có vài điểm ảnh đặc mới tính là nội dung (bỏ qua nhiễu lác đác của mask).
    if (solid > 4) {
      if (firstRow < 0) firstRow = y;
      lastRow = y;
    }
  }
  g.putImageData(img, 0, 0);
  if (firstRow < 0) return { canvas, padTop: 0, padBottom: 0 };
  return { canvas, padTop: firstRow / CUT_H, padBottom: 1 - (lastRow + 1) / CUT_H };
}

/** drawImage với khung nguồn tràn ra ngoài video: Safari sẽ không vẽ gì nếu không cắt khung lại. */
function drawClamped(
  g: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  sx: number, sy: number, sw: number, sh: number,
  vw: number, vh: number,
) {
  const x0 = Math.max(0, sx), y0 = Math.max(0, sy);
  const x1 = Math.min(vw, sx + sw), y1 = Math.min(vh, sy + sh);
  if (x1 <= x0 || y1 <= y0) return;
  const kx = CUT_W / sw, ky = CUT_H / sh;
  g.drawImage(video, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * kx, (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
}

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
