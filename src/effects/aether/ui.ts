// Trạng thái hiển thị và lệnh trao đổi giữa AetherRuntime (trong Canvas) và Overlay (DOM) qua EffectBus.
import type { MagicState } from "./magic/MagicStateMachine";
import type { Gesture } from "./tracking/GestureClassifier";

export type AetherUi = {
  state: MagicState;
  tracking: "searching" | "tracked" | "lost";
  gesture: Gesture;
  /** Mức nạp làm tròn 0.05 (để giao diện không vẽ lại mỗi khung hình). */
  charge: number;
  sound: boolean;
};

export const AETHER_COMMANDS = { restart: "restart", release: "release", soundOn: "sound:on", soundOff: "sound:off" } as const;

export const STATE_LABEL: Record<MagicState, string> = {
  IDLE: "Chờ triệu hồi",
  SUMMONING: "Đang hội tụ",
  ACTIVE: "Ổn định",
  CHARGING: "Đang nạp",
  RELEASE: "Giải phóng",
  COOLDOWN: "Hồi năng lượng",
};
