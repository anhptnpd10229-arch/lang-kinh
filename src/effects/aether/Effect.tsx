"use client";

// AETHER: triệu hồi quả cầu năng lượng trên lòng bàn tay.
// Effect tự render (useFrame ưu tiên 1) để có hậu kỳ bloom; tự lật gương video (meta.selfMirror).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { EffectProps } from "../types";
import { AetherRuntime, DEPTH } from "./AetherRuntime";
import { AETHER_QUALITY } from "./effects/uniforms";

export { default as Overlay } from "./Overlay";

export default function Effect({ hub, quality, notify, video, bus }: EffectProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const [runtime, setRuntime] = useState<AetherRuntime | null>(null);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  // Tạo trong effect (không phải useMemo) để chế độ StrictMode gắn–gỡ–gắn lại vẫn có runtime còn sống.
  useEffect(() => {
    const r = new AetherRuntime(video, bus, AETHER_QUALITY[qualityRef.current]);
    setRuntime(r);
    return () => r.dispose();
  }, [video, bus]);
  useEffect(() => runtime?.setQuality(quality), [runtime, quality]);
  useEffect(() => runtime?.setNotify(notify), [runtime, notify]);

  useFrame((state, delta) => {
    if (!runtime) return;
    const dt = Math.min(delta, 0.05);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const h = 2 * DEPTH * tan;
    // Số pixel (của bộ đệm vẽ) ứng với 1 đơn vị cảnh ở khoảng cách 1, cho kích thước hạt.
    const pixelScale = state.gl.getDrawingBufferSize(SIZE).y / (2 * tan);
    runtime.update(hub.results.hand, hub.results.timestamp, performance.now(), dt, h * camera.aspect, h, camera, pixelScale);
    runtime.render(state.gl, state.scene, camera, dt);
  }, 1);

  return runtime ? <primitive object={runtime.scene.root} /> : null;
}

const SIZE = new THREE.Vector2();
