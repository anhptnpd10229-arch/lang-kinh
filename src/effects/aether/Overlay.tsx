"use client";

// Giao diện tối giản của AETHER, nằm trên Canvas (không bị lật gương).
// Đọc trạng thái từ EffectBus; gửi lệnh (âm thanh, giải phóng, khởi động lại) ngược về AetherRuntime.
// Các nút mờ đi khi người dùng đang điều khiển quả cầu và không đụng tới màn hình.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { OverlayProps } from "../types";
import { AETHER_COMMANDS, STATE_LABEL, type AetherUi } from "./ui";

const SEEN_KEY = "aether.seen";
const DIM_AFTER_MS = 2500;

const GUIDE: [string, string][] = [
  ["Xoè bàn tay", "triệu hồi quả cầu"],
  ["Di chuyển tay", "quả cầu bay theo"],
  ["Chụm cái + trỏ", "ổn định, nối sợi năng lượng"],
  ["Nắm tay", "nạp năng lượng"],
  ["Mở tay + đẩy tới", "giải phóng"],
];

export default function Overlay({ bus }: OverlayProps) {
  const ui = useSyncExternalStore(bus.subscribe, bus.get, bus.get) as Partial<AetherUi>;
  const [guide, setGuide] = useState(false);
  const [intro, setIntro] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  const state = ui.state ?? "IDLE";
  const live = state === "ACTIVE" || state === "CHARGING";

  // Lời chỉ dẫn lần đầu: hiện tới khi người dùng triệu hồi được quả cầu lần đầu.
  useEffect(() => {
    try {
      setIntro(localStorage.getItem(SEEN_KEY) !== "1");
    } catch {
      setIntro(true);
    }
    setCanFullscreen(!!document.documentElement.requestFullscreen);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (state === "IDLE" || !intro) return;
    setIntro(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Không lưu được (chế độ riêng tư…): lần sau hiện lại, không sao.
    }
  }, [state, intro]);

  // Làm mờ nút khi đang điều khiển và không chạm màn hình.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), DIM_AFTER_MS);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  const tracking = ui.tracking ?? "searching";
  const trackingText = tracking === "tracked" ? "Đã thấy tay" : tracking === "lost" ? "Mất dấu tay" : "Đang tìm tay…";

  return (
    <div className={`ae ${idle && live ? "ae-dim" : ""}`}>
      <div className="ae-mark" aria-label="AETHER">AETHER</div>

      <div className="ae-status" role="status">
        <span className={`ae-dot ae-${tracking}`} />
        <span>{trackingText}</span>
        <span className="ae-state">· {STATE_LABEL[state]}</span>
      </div>

      <div className="ae-tools">
        <button
          className="ae-icon"
          aria-pressed={!!ui.sound}
          aria-label={ui.sound ? "Tắt âm thanh" : "Bật âm thanh"}
          title={ui.sound ? "Tắt âm thanh" : "Bật âm thanh"}
          onClick={() => bus.send(ui.sound ? AETHER_COMMANDS.soundOff : AETHER_COMMANDS.soundOn)}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {ui.sound ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16 9l5 6M21 9l-5 6" />}
          </svg>
        </button>
        {canFullscreen && (
          <button className="ae-icon" aria-label="Toàn màn hình" title="Toàn màn hình" onClick={toggleFullscreen}>
            <svg viewBox="0 0 24 24" aria-hidden>
              {fullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        )}
        <button className="ae-icon" aria-label="Khởi động lại hiệu ứng" title="Khởi động lại hiệu ứng" onClick={() => bus.send(AETHER_COMMANDS.restart)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
          </svg>
        </button>
        <button className="ae-icon ae-text" aria-expanded={guide} onClick={() => setGuide((g) => !g)}>
          Cử chỉ
        </button>
      </div>

      {guide && (
        <dl className="ae-guide">
          {GUIDE.map(([g, d]) => (
            <div key={g}>
              <dt>{g}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      )}

      {intro && state === "IDLE" && (
        <div className="ae-intro">
          <p className="ae-intro-title">Giơ bàn tay lên và xoè ra</p>
          <p>Lòng bàn tay hướng về camera, giữ yên một nhịp để năng lượng hội tụ.</p>
        </div>
      )}

      {(live || state === "SUMMONING") && (
        <div className="ae-bottom">
          {state === "CHARGING" && (
            <div className="ae-meter" aria-label={`Năng lượng ${Math.round((ui.charge ?? 0) * 100)}%`}>
              <span style={{ transform: `scaleX(${ui.charge ?? 0})` }} />
            </div>
          )}
          {live && (
            <button className="ae-release" onClick={() => bus.send(AETHER_COMMANDS.release)}>
              Giải phóng
            </button>
          )}
        </div>
      )}
    </div>
  );
}
