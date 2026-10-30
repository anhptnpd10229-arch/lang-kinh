// Trạng thái hiển thị và lệnh trao đổi giữa runtime (trong Canvas) và Overlay (DOM) qua EffectBus.
import type { ArmorState } from "./magic/TransformMachine";

export type ArmorUi = {
  state: ArmorState;
  tracking: "searching" | "tracked" | "lost";
  sound: boolean;
};

export const ARMOR_COMMANDS = { toggle: "toggle", soundOn: "sound:on", soundOff: "sound:off" } as const;

export const STATE_LABEL: Record<ArmorState, string> = {
  IDLE: "Sẵn sàng",
  ARMING: "Dang tay ra!",
  TRANSFORMING: "Đang biến hình",
  ARMORED: "Đã mặc giáp",
  DETRANSFORMING: "Đang tháo giáp",
};
