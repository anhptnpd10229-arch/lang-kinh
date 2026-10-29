// Phân loại cử chỉ ổn định từ đặc trưng bàn tay:
// - Ngưỡng trễ (hysteresis): vào trạng thái và ra trạng thái dùng hai ngưỡng khác nhau.
// - Xác nhận theo thời gian: cử chỉ phải giữ đủ lâu mới được công nhận.
// - Ngưỡng độ tin cậy: tay có điểm tin cậy thấp coi như không có.
// - "Đẩy tới" (thrust): bàn tay to ra nhanh (tiến về phía camera) qua nhiều khung hình liên tiếp.
import type { HandFrame } from "./handFeatures";

export type Gesture = "none" | "open" | "pinch" | "fist";

export type GestureReading = {
  present: boolean;
  /** Cử chỉ đã được xác nhận theo thời gian. */
  gesture: Gesture;
  /** Cử chỉ thô của khung hình hiện tại (sau ngưỡng trễ). */
  raw: Gesture;
  /** Thời điểm gần nhất phát hiện cú đẩy tay về phía camera. */
  thrustAt: number;
};

export const MIN_CONFIDENCE = 0.6;
const OPEN_ON = 0.72, OPEN_OFF = 0.55;
const FIST_ON = 0.28, FIST_OFF = 0.42;
const PINCH_ON = 0.3, PINCH_OFF = 0.45;
const HOLD_MS: Record<Gesture, number> = { none: 150, open: 180, pinch: 120, fist: 160 };
/** Đẩy tới: kích thước tay tăng ít nhất 15% trong 300 ms, qua ít nhất 3 mẫu, mẫu sau không nhỏ hơn mẫu trước. */
const THRUST_WINDOW_MS = 300;
const THRUST_GROWTH = 1.15;
const THRUST_MIN_SAMPLES = 3;

export class GestureClassifier {
  private raw: Gesture = "none";
  private candidate: Gesture = "none";
  private candidateSince = 0;
  private stable: Gesture = "none";
  private history: { t: number; s: number }[] = [];
  private thrustAt = -Infinity;

  update(frame: HandFrame | null, ts: number): GestureReading {
    if (!frame || frame.confidence < MIN_CONFIDENCE) {
      this.raw = "none";
      this.history = [];
      this.confirm("none", ts);
      return { present: false, gesture: this.stable, raw: "none", thrustAt: this.thrustAt };
    }

    this.raw = this.classify(frame);
    this.confirm(this.raw, ts);
    this.detectThrust(frame.scale, ts);
    return { present: true, gesture: this.stable, raw: this.raw, thrustAt: this.thrustAt };
  }

  reset() {
    this.raw = this.candidate = this.stable = "none";
    this.history = [];
    this.thrustAt = -Infinity;
  }

  private classify(f: HandFrame): Gesture {
    const prev = this.raw;
    const fist = prev === "fist" ? f.openness < FIST_OFF : f.openness < FIST_ON;
    if (fist) return "fist";
    const pinch = prev === "pinch" ? f.pinch < PINCH_OFF : f.pinch < PINCH_ON;
    if (pinch) return "pinch";
    const open = prev === "open" ? f.openness > OPEN_OFF : f.openness > OPEN_ON;
    return open ? "open" : "none";
  }

  private confirm(g: Gesture, ts: number) {
    if (g !== this.candidate) {
      this.candidate = g;
      this.candidateSince = ts;
    }
    if (ts - this.candidateSince >= HOLD_MS[g]) this.stable = g;
  }

  private detectThrust(scale: number, ts: number) {
    this.history.push({ t: ts, s: scale });
    while (this.history.length && ts - this.history[0].t > THRUST_WINDOW_MS) this.history.shift();
    const h = this.history;
    if (h.length < THRUST_MIN_SAMPLES) return;
    const tail = h.slice(-THRUST_MIN_SAMPLES);
    // Cho phép rung nhẹ 2% giữa các mẫu.
    const rising = tail.every((p, i) => i === 0 || p.s >= tail[i - 1].s * 0.98);
    const min = Math.min(...h.map((p) => p.s));
    if (rising && scale / min >= THRUST_GROWTH) this.thrustAt = ts;
  }
}
