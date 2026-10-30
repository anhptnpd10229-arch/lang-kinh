"use client";

// "Biến Hình Chiến Binh": bắt chéo tay rồi dang ra để giáp bay tới gắn lên người.
// Canvas trong suốt, lật gương bằng CSS cùng video; giáp kim loại cần ánh sáng môi trường nên
// tạo RoomEnvironment (không cần tệp ảnh) gắn vào scene trong lúc effect chạy.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { EffectProps } from "../types";
import { ChienBinhRuntime, DEPTH } from "./ChienBinhRuntime";

export { default as Overlay } from "./Overlay";

export default function Effect({ hub, quality, notify, video, bus }: EffectProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const [runtime, setRuntime] = useState<ChienBinhRuntime | null>(null);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  // Tạo trong effect (không phải useMemo) để StrictMode gắn–gỡ–gắn lại vẫn có runtime còn sống.
  useEffect(() => {
    const r = new ChienBinhRuntime(video, bus, qualityRef.current);
    setRuntime(r);
    return () => r.dispose();
  }, [video, bus]);
  useEffect(() => runtime?.setQuality(quality), [runtime, quality]);
  useEffect(() => runtime?.setNotify(notify), [runtime, notify]);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const prev = scene.environment;
    scene.environment = env;
    return () => {
      scene.environment = prev;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useFrame((_, delta) => {
    if (!runtime) return;
    const h = 2 * DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    runtime.update(hub.results.pose, hub.results.timestamp, performance.now(), Math.min(delta, 0.05), h * camera.aspect, h);
  });

  return runtime ? (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 25, 20]} intensity={1.6} />
      <directionalLight position={[-15, -5, 10]} intensity={0.5} color="#c9b9ff" />
      <primitive object={runtime.scene.root} />
    </>
  ) : null;
}
