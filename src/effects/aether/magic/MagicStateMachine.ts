// Máy trạng thái phép thuật, thuần logic để mô phỏng được:
// IDLE → SUMMONING → ACTIVE → CHARGING → RELEASE → COOLDOWN → IDLE
//
// - Xoè tay (đã xác nhận) khi đang IDLE: triệu hồi quả cầu.
// - Nắm tay khi ACTIVE: nạp năng lượng.
// - Đang nạp mà mở tay ra: "mồi" trong một khoảng ngắn; nếu có cú đẩy tay tới gần lúc đó thì giải phóng,
//   không thì quay về ACTIVE (năng lượng hao dần). Như vậy một khung hình sai không thể kích hoạt giải phóng.
// - Mất tay: hiệu ứng mờ dần ngay; mất quá lâu thì về IDLE.
import type { GestureReading } from "../tracking/GestureClassifier";

export type MagicState = "IDLE" | "SUMMONING" | "ACTIVE" | "CHARGING" | "RELEASE" | "COOLDOWN";

export type MagicEvent = "summon" | "active" | "charge" | "release" | "fizzle" | "idle" | "restart";

export const TIMING = {
  summonMs: 900,
  releaseMs: 1100,
  cooldownMs: 1300,
  /** Mất tay lâu hơn chừng này thì quả cầu tắt hẳn. */
  lostMs: 700,
  /** Mất tay trong lúc đang triệu hồi thì huỷ sớm hơn. */
  lostSummonMs: 400,
  /** Thời gian nạp từ 0 tới đầy. */
  chargeFullMs: 1800,
  /** Sau khi mở tay từ nắm tay, chờ cú đẩy tới trong khoảng này. */
  primeMs: 700,
  /** Cú đẩy xảy ra trước khi tay được xác nhận là mở (tối đa chừng này) vẫn tính. */
  thrustLeadMs: 350,
  /** Năng lượng tối thiểu để có thể giải phóng bằng cử chỉ. */
  minCharge: 0.25,
  /** Năng lượng hao mỗi giây khi thôi nạp. */
  decayPerS: 0.5,
  /** Độ mờ dần/hiện dần khi mất/thấy tay (mỗi giây). */
  fadePerS: 3,
};

export class MagicStateMachine {
  state: MagicState = "IDLE";
  since = 0;
  /** Năng lượng 0→1. */
  charge = 0;
  /** Năng lượng lúc giải phóng (quyết định độ mạnh của sóng xung kích). */
  releasePower = 0;
  /** 0→1: mức hiện diện của hiệu ứng (mờ dần khi mất tay). */
  presence = 0;
  pinching = false;
  onEvent: ((e: MagicEvent) => void) | null = null;

  private lastSeen = -Infinity;
  private present = false;
  private gesture: GestureReading["gesture"] = "none";
  private primedAt = 0;

  /** Tiến độ 0→1 của trạng thái hiện tại (cho các trạng thái có thời lượng). */
  progress(now: number) {
    const d = this.state === "SUMMONING" ? TIMING.summonMs : this.state === "RELEASE" ? TIMING.releaseMs : this.state === "COOLDOWN" ? TIMING.cooldownMs : 0;
    return d ? Math.min(1, (now - this.since) / d) : 0;
  }

  /** Gọi khi có kết quả nhận diện mới. */
  input(r: GestureReading, now: number) {
    this.present = r.present;
    this.gesture = r.gesture;
    if (r.present) this.lastSeen = now;
    this.pinching = r.present && r.gesture === "pinch" && (this.state === "ACTIVE" || this.state === "SUMMONING");

    switch (this.state) {
      case "IDLE":
        if (r.present && r.gesture === "open") this.go("SUMMONING", now, "summon");
        break;
      case "ACTIVE":
        if (r.present && r.gesture === "fist") this.go("CHARGING", now, "charge");
        break;
      case "CHARGING":
        if (!r.present) break;
        if (r.gesture === "fist") {
          this.primedAt = 0;
        } else if (r.gesture === "open" && this.charge >= TIMING.minCharge && !this.primedAt) {
          this.primedAt = now;
        }
        if (this.primedAt) {
          const thrustOk = r.thrustAt >= this.primedAt - TIMING.thrustLeadMs && r.thrustAt <= now;
          if (thrustOk) this.release(now, false);
        } else if (r.gesture === "open") {
          // Mở tay khi chưa nạp đủ: thôi nạp.
          this.go("ACTIVE", now, "fizzle");
        }
        break;
    }
  }

  /** Gọi mỗi khung hình render. */
  update(now: number, dt: number) {
    const lost = now - this.lastSeen;
    const live = this.state === "SUMMONING" || this.state === "ACTIVE" || this.state === "CHARGING";
    const target = live && this.present ? 1 : this.state === "RELEASE" ? this.presence : 0;
    this.presence += Math.sign(target - this.presence) * Math.min(Math.abs(target - this.presence), TIMING.fadePerS * dt);

    switch (this.state) {
      case "SUMMONING":
        if (lost > TIMING.lostSummonMs) this.go("IDLE", now, "idle");
        else if (now - this.since >= TIMING.summonMs) this.go("ACTIVE", now, "active");
        break;
      case "ACTIVE":
        this.charge = Math.max(0, this.charge - TIMING.decayPerS * dt);
        if (lost > TIMING.lostMs) this.go("IDLE", now, "idle");
        break;
      case "CHARGING":
        if (!this.primedAt && this.gesture === "fist" && this.present) {
          this.charge = Math.min(1, this.charge + (dt * 1000) / TIMING.chargeFullMs);
        }
        if (this.primedAt && now - this.primedAt > TIMING.primeMs) {
          this.primedAt = 0;
          this.go("ACTIVE", now, "fizzle");
        }
        if (lost > TIMING.lostMs) this.go("IDLE", now, "idle");
        break;
      case "RELEASE":
        if (now - this.since >= TIMING.releaseMs) this.go("COOLDOWN", now);
        break;
      case "COOLDOWN":
        if (now - this.since >= TIMING.cooldownMs) this.go("IDLE", now, "idle");
        break;
    }
  }

  /** Giải phóng. `manual` = bấm nút trên màn hình (cho phép từ ACTIVE với năng lượng tối thiểu). */
  release(now: number, manual: boolean): boolean {
    if (this.state !== "CHARGING" && !(manual && this.state === "ACTIVE")) return false;
    this.releasePower = Math.max(this.charge, manual ? 0.5 : TIMING.minCharge);
    this.charge = 0;
    this.primedAt = 0;
    this.go("RELEASE", now, "release");
    return true;
  }

  restart(now: number) {
    this.charge = 0;
    this.primedAt = 0;
    this.presence = 0;
    this.go("IDLE", now, "restart");
  }

  private go(state: MagicState, now: number, event?: MagicEvent) {
    this.state = state;
    this.since = now;
    if (state !== "CHARGING") this.primedAt = 0;
    if (event) this.onEvent?.(event);
  }
}
