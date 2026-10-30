"use client";

// Trang trải nghiệm: máy trạng thái từ "chưa bắt đầu" → xin quyền → tải mô hình → đang chạy,
// kèm màn hình riêng cho từng trường hợp lỗi. Camera chỉ mở khi người dùng bấm nút.
import { Canvas, useFrame } from "@react-three/fiber";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { EffectBus } from "@/core/bus";
import { CAMERA_ERROR_TEXT, checkSupport, classifyCameraError, openCamera, stopCamera } from "@/core/camera";
import { initialQuality, PerfMonitor, fpsBucket, type Quality } from "@/core/perf";
import { track } from "@/core/telemetry";
import { TrackerHub, type TrackerKind } from "@/core/tracker-hub";
import { EFFECT_LOADERS } from "@/effects/loaders";
import type { EffectMeta, EffectProps, OverlayProps } from "@/effects/types";
import { BackIcon, LockIcon } from "./icons";

type Phase =
  | { kind: "idle" }
  | { kind: "unsupported"; text: string }
  | { kind: "requesting" }
  | { kind: "loading" }
  | { kind: "running" }
  | { kind: "error"; text: string };

const SUBJECT: Record<TrackerKind, string> = {
  face: "khuôn mặt",
  hand: "bàn tay",
  pose: "cả người",
  segmentation: "người",
};

const DPR: Record<Quality, [number, number]> = { high: [1, 2], medium: [1, 1.5], low: [1, 1] };
const HINT_MS = 5000;
const LOST_MS = 3000;
const TOAST_MS = 1600;

export default function Player({ meta }: { meta: EffectMeta }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hubRef = useRef<TrackerHub | null>(null);
  const perfRef = useRef<PerfMonitor | null>(null);
  const startedAt = useRef(0);
  const detectedOnce = useRef(false);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [inApp, setInApp] = useState(false);
  const [Effect, setEffect] = useState<ComponentType<EffectProps> | null>(null);
  const [Overlay, setOverlay] = useState<ComponentType<OverlayProps> | null>(null);
  const busRef = useRef<EffectBus | null>(null);
  const [quality, setQuality] = useState<Quality>("medium");
  const [aspect, setAspect] = useState(4 / 3);
  const [fps, setFps] = useState(0);
  const [lost, setLost] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setInApp(checkSupport().inAppBrowser), []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const stop = useCallback(() => {
    if (startedAt.current) {
      track("session_end", {
        slug: meta.slug,
        seconds: Math.round((performance.now() - startedAt.current) / 1000),
        fps: fpsBucket(perfRef.current?.fps ?? 0),
      });
    }
    startedAt.current = 0;
    hubRef.current?.close();
    hubRef.current = null;
    stopCamera(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setEffect(null);
    setOverlay(null);
    busRef.current = null;
    setPhase({ kind: "idle" });
  }, [meta.slug]);

  const start = useCallback(async () => {
    track("start_click", { slug: meta.slug });
    const s = checkSupport();
    if (!s.secure) return setPhase({ kind: "unsupported", text: CAMERA_ERROR_TEXT.insecure });
    if (!s.media || !s.wasm) {
      return setPhase({
        kind: "unsupported",
        text: "Trình duyệt này chưa hỗ trợ camera trên web. Hãy thử Safari (iPhone) hoặc Chrome (Android, máy tính) bản mới.",
      });
    }

    const q = initialQuality();
    setQuality(q);
    setPhase({ kind: "requesting" });
    let stream: MediaStream;
    try {
      stream = await openCamera({ facing: meta.facing, height: q === "high" ? 720 : 480 });
    } catch (err) {
      const kind = classifyCameraError(err);
      track("camera_error", { slug: meta.slug, kind });
      return setPhase({ kind: "error", text: CAMERA_ERROR_TEXT[kind] });
    }
    streamRef.current = stream;
    track("camera_granted", { slug: meta.slug });

    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();
    setAspect(video.videoWidth / video.videoHeight || 4 / 3);

    setPhase({ kind: "loading" });
    const t0 = performance.now();
    try {
      const [hub, mod] = await Promise.all([
        TrackerHub.create(meta.trackers, s.webgl2 ? "GPU" : "CPU"),
        EFFECT_LOADERS[meta.slug](),
      ]);
      if (!streamRef.current) return hub.close(); // người dùng đã thoát trong lúc tải
      hub.stride = q === "low" ? 2 : 1;
      hub.start(video);
      hubRef.current = hub;
      perfRef.current = new PerfMonitor(q, (next, f) => {
        setFps(f);
        setQuality(next);
        hub.stride = next === "low" ? 2 : 1;
      });
      track("model_loaded", { slug: meta.slug, ms: Math.round(performance.now() - t0), delegate: hub.delegate });
      busRef.current = new EffectBus();
      setEffect(() => mod.default);
      setOverlay(() => mod.Overlay ?? null);
      startedAt.current = performance.now();
      detectedOnce.current = false;
      setShowHint(true);
      setPhase({ kind: "running" });
    } catch (err) {
      console.error(err);
      stopCamera(streamRef.current);
      streamRef.current = null;
      setPhase({ kind: "error", text: "Không tải được hiệu ứng. Kiểm tra kết nối mạng rồi thử lại." });
    }
  }, [meta]);

  // Gợi ý tương tác, cảnh báo mất đối tượng, sự kiện first_detection.
  useEffect(() => {
    if (phase.kind !== "running") return;
    const hintTimer = setTimeout(() => setShowHint(false), HINT_MS);
    const poll = setInterval(() => {
      const hub = hubRef.current;
      if (!hub) return;
      const now = performance.now();
      if (hub.lastDetectionAt && !detectedOnce.current) {
        detectedOnce.current = true;
        track("first_detection", { slug: meta.slug, ms: Math.round(now - startedAt.current) });
      }
      setLost(now - Math.max(hub.lastDetectionAt, startedAt.current) > LOST_MS);
    }, 500);
    return () => {
      clearTimeout(hintTimer);
      clearInterval(poll);
    };
  }, [phase.kind, meta.slug]);

  // Tắt hẳn camera khi rời tab hoặc rời trang.
  useEffect(() => {
    const onHide = () => document.hidden && streamRef.current && stop();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  const running = phase.kind === "running";
  const subject = SUBJECT[meta.trackers[0]];

  return (
    <div className="player">
      <div
        className={`frame ${meta.facing === "user" && !meta.selfMirror ? "mirror" : ""}`}
        style={{ "--ar": aspect } as React.CSSProperties}
      >
        <video ref={videoRef} playsInline muted />
        {running && Effect && hubRef.current && videoRef.current && busRef.current && (
          <Canvas
            camera={{ fov: 63, near: 1, far: 2000, position: [0, 0, 0] }}
            gl={{ alpha: true, antialias: quality !== "low", powerPreference: "high-performance" }}
            dpr={DPR[quality]}
          >
            <PerfProbe monitor={perfRef.current} />
            <Effect hub={hubRef.current} quality={quality} notify={notify} video={videoRef.current} bus={busRef.current} />
          </Canvas>
        )}
      </div>

      {running ? (
        <>
          {Overlay && busRef.current && (
            <div className="effect-overlay">
              <Overlay bus={busRef.current} notify={notify} />
            </div>
          )}
          <div className="live-pill" role="status">Camera đang bật</div>
          <div className="player-bar">
            <p className="player-hint" aria-live="polite">
              {lost
                ? `Không thấy ${subject} — hãy đưa ${subject} vào khung hình và đủ sáng.`
                : (toast ?? (showHint ? meta.howTo[0] : meta.title))}
            </p>
            <span className="player-fps">{fps ? `${fps.toFixed(0)} fps · ${quality}` : ""}</span>
            <button className="btn" onClick={stop}>Thoát</button>
          </div>
        </>
      ) : (
        <div className="player-overlay">
          <span className="player-blob b1" aria-hidden="true" />
          <span className="player-blob b2" aria-hidden="true" />
          <span className="player-blob b3" aria-hidden="true" />
          <Link href={`/works/${meta.slug}/`} className="back">
            <BackIcon />
            {meta.title}
          </Link>
          <div className="player-card">
            <h1>{meta.title}</h1>
            {phase.kind === "idle" && (
              <>
                {inApp && (
                  <p className="warn">
                    Bạn đang mở trong ứng dụng (Zalo, Facebook…), camera có thể bị chặn. Hãy chọn “Mở bằng trình duyệt” trong menu ⋯.
                  </p>
                )}
                <ol className="steps">
                  {meta.howTo.map((h, i) => (
                    <li key={h}>
                      <span className={`step-n tone-${i % 3}`}>{i + 1}</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ol>
                <button className="btn primary" onClick={start}>Bắt đầu trải nghiệm</button>
                <p className="fine">
                  <LockIcon />
                  Hình ảnh được xử lý ngay trên thiết bị của bạn. Không ghi lại, không gửi đi.
                </p>
              </>
            )}
            {phase.kind === "requesting" && <p>Đang xin quyền camera… Hãy chọn “Cho phép” khi trình duyệt hỏi.</p>}
            {phase.kind === "loading" && <p className="loading">Đang tải mô hình nhận diện…</p>}
            {(phase.kind === "error" || phase.kind === "unsupported") && (
              <>
                <p className="warn">{phase.text}</p>
                {phase.kind === "error" && <button className="btn primary" onClick={start}>Thử lại</button>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PerfProbe({ monitor }: { monitor: PerfMonitor | null }) {
  useFrame(() => monitor?.tick());
  return null;
}
