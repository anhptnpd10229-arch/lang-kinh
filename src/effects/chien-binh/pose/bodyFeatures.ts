// Đặc trưng nửa người trên từ 33 điểm của MediaPipe Pose, thuần logic để mô phỏng được.
// Toạ độ ảnh gốc (chưa lật gương — khung hình được lật bằng CSS cùng video); x được nhân tỉ lệ khung hình
// để khoảng cách ngang và dọc cùng đơn vị (chiều cao ảnh).

export type Pt = { x: number; y: number };
type Landmark = { x: number; y: number; z?: number; visibility?: number };

export const IDX = {
  nose: 0,
  eyeL: 2,
  eyeR: 5,
  earL: 7,
  earR: 8,
  shL: 11,
  shR: 12,
  elL: 13,
  elR: 14,
  wrL: 15,
  wrR: 16,
} as const;
export type Joint = keyof typeof IDX;

export type Body = {
  /** Toạ độ đã nhân tỉ lệ khung hình (x * aspect, y). */
  p: Record<Joint, Pt>;
  /** Độ rộng vai: thước đo kích thước cơ thể trên hình. */
  sw: number;
  /** Hai cẳng tay đều thấy được (đủ tin cậy). */
  armsVisible: boolean;
  /** Bắt chéo hai tay trước ngực. */
  crossed: boolean;
  /** Dang rộng hai tay sang hai bên. */
  spread: boolean;
  /** Giơ cả hai tay lên cao hơn đầu. */
  handsUp: boolean;
};

const MIN_VIS = 0.5;
const MIN_ARM_VIS = 0.4;
/** Người đứng quá xa (vai hẹp hơn chừng này chiều cao ảnh) thì không đủ chi tiết để đặt giáp. */
const MIN_SHOULDER = 0.06;

export function bodyFrame(lm: Landmark[] | undefined, aspect: number): Body | null {
  if (!lm || lm.length < 17) return null;
  const vis = (j: Joint) => lm[IDX[j]].visibility ?? 1;
  if (vis("shL") < MIN_VIS || vis("shR") < MIN_VIS) return null;

  const p = Object.fromEntries(
    (Object.keys(IDX) as Joint[]).map((j) => [j, { x: lm[IDX[j]].x * aspect, y: lm[IDX[j]].y }]),
  ) as Record<Joint, Pt>;
  const sw = dist(p.shL, p.shR);
  if (sw < MIN_SHOULDER) return null;

  const armsVisible = (["elL", "elR", "wrL", "wrR"] as Joint[]).every((j) => vis(j) >= MIN_ARM_VIS);
  const cx = (p.shL.x + p.shR.x) / 2;
  const chest = { x: cx, y: (p.shL.y + p.shR.y) / 2 + 0.6 * sw };
  const sideL = Math.sign(p.shL.x - cx);
  const sideR = Math.sign(p.shR.x - cx);
  const side = (q: Pt) => Math.sign(q.x - cx);

  // Bắt chéo: mỗi cổ tay sang phía vai bên kia, và cả hai ở gần ngực.
  const crossed =
    armsVisible &&
    side(p.wrL) === sideR &&
    side(p.wrR) === sideL &&
    dist(p.wrL, chest) < 1.2 * sw &&
    dist(p.wrR, chest) < 1.2 * sw;

  // Dang tay: hai cổ tay ở hai phía, xa thân hơn vai một khoảng, và không buông thõng xuống dưới bụng.
  const reach = 1.25 * sw;
  const low = chest.y + 1.2 * sw;
  const spread =
    armsVisible &&
    side(p.wrL) === sideL &&
    side(p.wrR) === sideR &&
    Math.abs(p.wrL.x - cx) > reach &&
    Math.abs(p.wrR.x - cx) > reach &&
    p.wrL.y < low &&
    p.wrR.y < low;

  const headTop = vis("nose") >= MIN_VIS ? p.nose.y : Math.min(p.shL.y, p.shR.y) - 0.6 * sw;
  const handsUp = armsVisible && p.wrL.y < headTop - 0.1 * sw && p.wrR.y < headTop - 0.1 * sw;

  return { p, sw, armsVisible, crossed, spread, handsUp };
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
