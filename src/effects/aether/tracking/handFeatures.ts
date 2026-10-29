// Đặc trưng hình học của một bàn tay, tính từ 21 điểm của MediaPipe.
// Toạ độ trả về ở "không gian hiển thị": đã lật gương theo x (như người dùng nhìn thấy), y hướng xuống như ảnh.
// Khoảng cách được quy về đơn vị chiều cao ảnh để không phụ thuộc tỉ lệ khung hình.

type P = { x: number; y: number; z: number };

export type Point2 = { x: number; y: number };

export type HandFrame = {
  palm: Point2;
  wrist: Point2;
  thumbTip: Point2;
  indexTip: Point2;
  middleTip: Point2;
  /** 21 điểm (không gian hiển thị). */
  points: Point2[];
  /** Chiều dài cổ tay → gốc ngón giữa (đơn vị chiều cao ảnh); lớn khi tay gần camera. */
  scale: number;
  /** 0 = nắm chặt, 1 = xoè hết. */
  openness: number;
  /** Khoảng cách đầu ngón cái–trỏ chia cho kích thước bàn tay. */
  pinch: number;
  /** Góc nghiêng bàn tay trên màn hình (rad), 0 khi ngón tay chỉ thẳng lên. */
  roll: number;
  /** 0→1: lòng (hoặc mu) bàn tay hướng thẳng vào camera tới mức nào. */
  facing: number;
  confidence: number;
};

const PALM = [0, 5, 9, 13, 17];
/** [đầu ngón, gốc ngón] cho trỏ, giữa, áp út, út. Ngón cái bỏ qua vì gập/duỗi của nó ít ổn định trên camera. */
const FINGERS: [number, number][] = [[8, 5], [12, 9], [16, 13], [20, 17]];
/**
 * Tỉ lệ (cổ tay→đầu ngón)/(cổ tay→gốc ngón) khi ngón gập hẳn và khi duỗi.
 * Ngón giữa dài xấp xỉ lòng bàn tay nên duỗi thẳng cho ~1.9; lấy 1.75 để tay xoè tự nhiên (hơi cong) vẫn tính là mở.
 */
const CURLED = 1.1;
const EXTENDED = 1.75;

export function handFrame(lm: P[], world: P[] | undefined, confidence: number, aspect: number): HandFrame {
  const disp = (p: P): Point2 => ({ x: 1 - p.x, y: p.y });
  // Khoảng cách theo đơn vị chiều cao ảnh (x được nhân tỉ lệ khung hình; z của MediaPipe cùng thang với x).
  const d = (a: number, b: number) =>
    Math.hypot((lm[a].x - lm[b].x) * aspect, lm[a].y - lm[b].y, (lm[a].z - lm[b].z) * aspect);

  const palm = PALM.reduce((s, i) => ({ x: s.x + lm[i].x / PALM.length, y: s.y + lm[i].y / PALM.length, z: 0 }), { x: 0, y: 0, z: 0 });
  const scale = d(0, 9) || 1e-3;

  const ratio = FINGERS.reduce((s, [tip, mcp]) => s + d(0, tip) / (d(0, mcp) || 1e-3), 0) / FINGERS.length;
  const openness = Math.min(1, Math.max(0, (ratio - CURLED) / (EXTENDED - CURLED)));

  const wrist = disp(lm[0]);
  const mcp = disp(lm[9]);
  const roll = Math.atan2((mcp.x - wrist.x) * aspect, -(mcp.y - wrist.y));

  let facing = 1;
  if (world && world.length >= 18) {
    // Pháp tuyến lòng bàn tay từ toạ độ 3D (mét): tích có hướng của (cổ tay→gốc trỏ) × (cổ tay→gốc út).
    const a = sub(world[5], world[0]);
    const b = sub(world[17], world[0]);
    const n = { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
    facing = Math.abs(n.z) / (Math.hypot(n.x, n.y, n.z) || 1);
  }

  return {
    palm: disp(palm),
    wrist,
    thumbTip: disp(lm[4]),
    indexTip: disp(lm[8]),
    middleTip: disp(lm[12]),
    points: lm.map(disp),
    scale,
    openness,
    pinch: d(4, 8) / scale,
    roll,
    facing,
    confidence,
  };
}

const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
