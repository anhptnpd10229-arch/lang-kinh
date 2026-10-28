// Chu trình giặt thuần logic (không phụ thuộc three.js/DOM) để dễ mô phỏng:
// rảnh → cấp nước (lồng đứng yên, nước dâng từ từ) → giặt (đảo chiều) → vắt (quay nhanh, xả nước)
// → lấy đồ ra giũ cho phẳng → phơi → rảnh.

export type Phase = "idle" | "fill" | "wash" | "spin" | "unload" | "hang";

const DURATION: Record<Exclude<Phase, "idle">, number> = {
  fill: 3500,
  wash: 4500,
  spin: 2500,
  unload: 2600,
  hang: 1600,
};
const ORDER: Exclude<Phase, "idle">[] = ["fill", "wash", "spin", "unload", "hang"];
/** Các pha máy đang chạy (có thể bấm dừng, có đếm ngược). */
const RUNNING: Phase[] = ["fill", "wash", "spin"];

/** Mốc thời gian trong pha lấy đồ: bật ra khỏi lồng, rồi giũ SNAPS lần. */
export const UNLOAD = { popMs: 450, snaps: 3, snapMs: 620 };

const easeInOut = (t: number) => t * t * (3 - 2 * t);

export class WashCycle {
  phase: Phase = "idle";
  private since = 0;

  get running() {
    return RUNNING.includes(this.phase);
  }

  start(now: number): boolean {
    if (this.phase !== "idle") return false;
    this.phase = "fill";
    this.since = now;
    return true;
  }

  /** Dừng giữa chừng (không phơi). */
  cancel(now: number): boolean {
    if (!this.running) return false;
    this.phase = "idle";
    this.since = now;
    return true;
  }

  /** Chuyển pha khi hết giờ; trả về pha mới hoặc null. Gọi lặp tới khi null nếu khung hình bị trễ lâu. */
  update(now: number): Phase | null {
    if (this.phase === "idle") return null;
    const d = DURATION[this.phase];
    if (now - this.since < d) return null;
    this.since += d;
    this.phase = ORDER[ORDER.indexOf(this.phase) + 1] ?? "idle";
    return this.phase;
  }

  /** Thời điểm bắt đầu pha hiện tại. */
  get phaseStart() {
    return this.since;
  }

  /** Tiến độ 0→1 của pha hiện tại. */
  progress(now: number): number {
    if (this.phase === "idle") return 0;
    return Math.min(1, Math.max(0, (now - this.since) / DURATION[this.phase]));
  }

  /** Thời gian còn lại tới lúc giặt xong (ms), để hiện trên màn hình máy. */
  remainingMs(now: number): number {
    if (!this.running) return 0;
    const i = RUNNING.indexOf(this.phase);
    const rest = RUNNING.slice(i).reduce((s, p) => s + DURATION[p as Exclude<Phase, "idle">], 0);
    return Math.max(0, rest - (now - this.since));
  }

  /** Tốc độ quay lồng (vòng/giây); dấu là chiều quay. Lồng chỉ quay khi nước đã cấp xong. */
  spinRate(now: number): number {
    const p = this.progress(now);
    switch (this.phase) {
      case "wash":
        // Bắt đầu từ đứng yên, đảo chiều 2 lần như máy giặt thật.
        return 1.1 * Math.sin(p * Math.PI * 4);
      case "spin":
        return p < 0.7 ? 0.5 + (p / 0.7) * 3 : 3.5 * (1 - (p - 0.7) / 0.3);
      default:
        return 0;
    }
  }

  /** Mực nước 0→1 theo chiều cao ô cửa. */
  water(now: number): number {
    const p = this.progress(now);
    switch (this.phase) {
      case "fill":
        return 0.5 * easeInOut(p);
      case "wash":
        return 0.5;
      case "spin":
        return 0.5 * Math.max(0, 1 - p * 2.5);
      default:
        return 0;
    }
  }

  /** Độ rung của thân máy 0→1. */
  shake(now: number): number {
    if (this.phase === "wash") return 0.15;
    if (this.phase === "spin") return Math.sin(this.progress(now) * Math.PI);
    return 0;
  }
}
