// Máy trạng thái biến hình, thuần logic để mô phỏng được:
// IDLE → ARMING (đã bắt chéo tay đủ lâu) → TRANSFORMING (dang tay ra) → ARMORED → DETRANSFORMING → IDLE
//
// - Bắt chéo tay phải giữ một nhịp mới "mồi"; sau khi thả tay, có một khoảng ngắn để dang tay ra.
//   Hết khoảng đó mà chưa dang tay thì huỷ, nên tình cờ khoanh tay không kích hoạt biến hình.
// - Đang mặc giáp: giơ hai tay lên cao → bùng năng lượng (có thời gian hồi);
//   bắt chéo tay giữ lâu hơn → tháo giáp.
import type { Body } from "../pose/bodyFeatures";

export type ArmorState = "IDLE" | "ARMING" | "TRANSFORMING" | "ARMORED" | "DETRANSFORMING";
export type ArmorEvent = "arming" | "cancel" | "transform" | "armored" | "power" | "detransform" | "idle";

export const TIMING = {
  crossHoldMs: 350,
  /** Sau khi thả tay khỏi thế bắt chéo, phải dang tay trong khoảng này. */
  spreadWindowMs: 1500,
  transformMs: 2800,
  detransformMs: 1000,
  /** Tháo giáp cần giữ bắt chéo lâu hơn, tránh tháo nhầm. */
  unarmHoldMs: 1200,
  powerHoldMs: 250,
  powerCooldownMs: 1800,
};

export class TransformMachine {
  state: ArmorState = "IDLE";
  since = 0;
  onEvent: ((e: ArmorEvent) => void) | null = null;

  private crossSince = 0;
  private releasedAt = 0;
  private upSince = 0;
  private lastPower = -Infinity;

  progress(now: number) {
    const d = this.state === "TRANSFORMING" ? TIMING.transformMs : this.state === "DETRANSFORMING" ? TIMING.detransformMs : 0;
    return d ? Math.min(1, (now - this.since) / d) : 0;
  }

  /** Gọi khi có kết quả tư thế mới (null = không thấy người). */
  input(b: Body | null, now: number) {
    const crossed = !!b?.crossed;
    if (crossed) {
      if (!this.crossSince) this.crossSince = now;
    } else {
      this.crossSince = 0;
    }
    const held = this.crossSince ? now - this.crossSince : 0;

    switch (this.state) {
      case "IDLE":
        if (held >= TIMING.crossHoldMs) this.go("ARMING", now, "arming");
        break;
      case "ARMING":
        if (crossed) {
          this.releasedAt = 0;
        } else {
          if (!this.releasedAt) this.releasedAt = now;
          if (b?.spread) this.go("TRANSFORMING", now, "transform");
        }
        break;
      case "ARMORED":
        if (held >= TIMING.unarmHoldMs) {
          this.go("DETRANSFORMING", now, "detransform");
          break;
        }
        if (b?.handsUp) {
          if (!this.upSince) this.upSince = now;
          if (now - this.upSince >= TIMING.powerHoldMs && now - this.lastPower >= TIMING.powerCooldownMs) {
            this.lastPower = now;
            this.onEvent?.("power");
          }
        } else {
          this.upSince = 0;
        }
        break;
    }
  }

  /** Gọi mỗi khung hình cho các mốc thời gian. */
  update(now: number) {
    switch (this.state) {
      case "ARMING":
        if (this.releasedAt && now - this.releasedAt > TIMING.spreadWindowMs) this.go("IDLE", now, "cancel");
        break;
      case "TRANSFORMING":
        if (now - this.since >= TIMING.transformMs) this.go("ARMORED", now, "armored");
        break;
      case "DETRANSFORMING":
        if (now - this.since >= TIMING.detransformMs) this.go("IDLE", now, "idle");
        break;
    }
  }

  /** Nút dự phòng: biến hình ngay (từ IDLE/ARMING) hoặc tháo giáp (từ ARMORED). */
  toggle(now: number): boolean {
    if (this.state === "IDLE" || this.state === "ARMING") {
      this.go("TRANSFORMING", now, "transform");
      return true;
    }
    if (this.state === "ARMORED") {
      this.go("DETRANSFORMING", now, "detransform");
      return true;
    }
    return false;
  }

  private go(state: ArmorState, now: number, event: ArmorEvent) {
    this.state = state;
    this.since = now;
    this.releasedAt = 0;
    this.upSince = 0;
    // Thế bắt chéo dùng để mồi không được tính tiếp cho bước sau (ví dụ tháo giáp ngay khi vừa mặc).
    this.crossSince = 0;
    this.onEvent?.(event);
  }
}
