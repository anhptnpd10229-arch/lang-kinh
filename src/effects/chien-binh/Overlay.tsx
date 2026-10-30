"use client";

// Giao diện phủ của "Biến Hình Chiến Binh": trạng thái theo dõi, bật/tắt âm thanh,
// hướng dẫn lần đầu và nút dự phòng Biến hình / Tháo giáp. Đọc và gửi lệnh qua EffectBus.
import { useSyncExternalStore } from "react";
import type { OverlayProps } from "../types";
import { ARMOR_COMMANDS, STATE_LABEL, type ArmorUi } from "./ui";

export default function Overlay({ bus }: OverlayProps) {
  const ui = useSyncExternalStore(bus.subscribe, bus.get, bus.get) as Partial<ArmorUi>;
  const state = ui.state ?? "IDLE";
  const tracking = ui.tracking ?? "searching";
  const trackingText = tracking === "tracked" ? "Đã thấy bạn" : tracking === "lost" ? "Mất dấu — lùi lại một chút" : "Đang tìm người…";
  const canToggle = state === "IDLE" || state === "ARMING" || state === "ARMORED";

  return (
    <div className="cb">
      <div className="cb-status" role="status">
        <span className={`cb-dot cb-${tracking}`} />
        <span>{trackingText}</span>
        <span className="cb-state">· {STATE_LABEL[state]}</span>
      </div>

      <button
        className="cb-sound"
        aria-pressed={!!ui.sound}
        aria-label={ui.sound ? "Tắt âm thanh" : "Bật âm thanh"}
        title={ui.sound ? "Tắt âm thanh" : "Bật âm thanh"}
        onClick={() => bus.send(ui.sound ? ARMOR_COMMANDS.soundOff : ARMOR_COMMANDS.soundOn)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {ui.sound ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16 9l5 6M21 9l-5 6" />}
        </svg>
      </button>

      {state === "IDLE" && tracking !== "tracked" && (
        <div className="cb-intro">
          <p className="cb-intro-title">Lùi lại để thấy cả nửa người trên</p>
          <p>Rồi bắt chéo hai tay trước ngực, giữ một nhịp và dang mạnh ra.</p>
        </div>
      )}

      {canToggle && (
        <div className="cb-bottom">
          <button className="btn primary" onClick={() => bus.send(ARMOR_COMMANDS.toggle)}>
            {state === "ARMORED" ? "Tháo giáp" : "Biến hình"}
          </button>
        </div>
      )}
    </div>
  );
}
