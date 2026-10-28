// Bộ lọc One-Euro (Casiez et al. 2012): làm mượt mạnh khi tay đứng yên, phản hồi nhanh khi tay di chuyển.
// minCutoff (Hz) giảm rung khi chậm; beta tăng độ nhạy theo tốc độ (đơn vị/giây của giá trị đầu vào).

const alpha = (dt: number, cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  constructor(
    private minCutoff = 1,
    private beta = 0.01,
    private dCutoff = 1,
  ) {}

  /** `tSec` là thời điểm tính bằng giây, tăng dần. */
  filter(value: number, tSec: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tSec;
      return value;
    }
    const dt = Math.max(tSec - this.t, 1e-3);
    this.t = tSec;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(dt, this.dCutoff) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(dt, cutoff) * (value - this.x);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}
