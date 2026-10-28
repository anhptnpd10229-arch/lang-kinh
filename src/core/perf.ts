// Đo FPS render và tự hạ chất lượng khi máy không theo kịp.

export type Quality = "high" | "medium" | "low";

const ORDER: Quality[] = ["high", "medium", "low"];
const DOWNGRADE_BELOW_FPS = 24;
const SECONDS_BEFORE_DOWNGRADE = 2;

export function initialQuality(): Quality {
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse) return cores >= 8 ? "medium" : "low";
  return cores >= 8 ? "high" : "medium";
}

export class PerfMonitor {
  fps = 0;
  private frames = 0;
  private windowStart = performance.now();
  private slowSeconds = 0;

  constructor(
    public quality: Quality,
    private onChange: (q: Quality, fps: number) => void,
  ) {}

  /** Gọi mỗi khung hình render. */
  tick(now = performance.now()) {
    this.frames++;
    const elapsed = now - this.windowStart;
    if (elapsed < 1000) return;

    this.fps = (this.frames * 1000) / elapsed;
    this.frames = 0;
    this.windowStart = now;

    this.slowSeconds = this.fps < DOWNGRADE_BELOW_FPS ? this.slowSeconds + 1 : 0;
    const next = ORDER[ORDER.indexOf(this.quality) + 1];
    if (this.slowSeconds >= SECONDS_BEFORE_DOWNGRADE && next) {
      this.quality = next;
      this.slowSeconds = 0;
    }
    this.onChange(this.quality, this.fps);
  }
}

/** Gom FPS vào khoảng để gửi analytics mà không lộ chi tiết thiết bị. */
export function fpsBucket(fps: number): string {
  if (fps < 15) return "<15";
  if (fps < 24) return "15-24";
  if (fps < 30) return "24-30";
  return ">30";
}
