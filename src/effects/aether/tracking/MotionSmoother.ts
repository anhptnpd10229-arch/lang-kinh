// Làm mượt vị trí, kích thước và góc nghiêng bàn tay bằng bộ lọc One-Euro, kèm vận tốc để biết tay đi nhanh hay chậm.
import { OneEuroFilter } from "@/core/one-euro";

export type SmoothedHand = { x: number; y: number; scale: number; roll: number; speed: number };

export class MotionSmoother {
  private fx = new OneEuroFilter(1.2, 4);
  private fy = new OneEuroFilter(1.2, 4);
  private fs = new OneEuroFilter(0.8, 2);
  private fr = new OneEuroFilter(1, 1);
  private last: { x: number; y: number; t: number; roll: number } | null = null;
  private speed = 0;

  /** x, y theo toạ độ chuẩn hoá (0..1), t tính bằng giây. */
  update(x: number, y: number, scale: number, roll: number, t: number): SmoothedHand {
    // Mở góc liên tục để bộ lọc không bị nhảy khi góc vượt ±π.
    if (this.last) {
      while (roll - this.last.roll > Math.PI) roll -= Math.PI * 2;
      while (roll - this.last.roll < -Math.PI) roll += Math.PI * 2;
    }
    const sx = this.fx.filter(x, t);
    const sy = this.fy.filter(y, t);
    const ss = this.fs.filter(scale, t);
    const sr = this.fr.filter(roll, t);
    if (this.last) {
      const dt = Math.max(t - this.last.t, 1e-3);
      const v = Math.hypot(sx - this.last.x, sy - this.last.y) / dt;
      this.speed += (v - this.speed) * Math.min(1, dt * 8);
    }
    this.last = { x: sx, y: sy, t, roll: sr };
    return { x: sx, y: sy, scale: ss, roll: sr, speed: this.speed };
  }

  reset() {
    for (const f of [this.fx, this.fy, this.fs, this.fr]) f.reset();
    this.last = null;
    this.speed = 0;
  }
}
