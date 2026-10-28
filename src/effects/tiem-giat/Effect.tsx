"use client";

// "Tiệm Giặt": khuôn mặt hiện trong lồng giặt; bấm GIẶT (hoặc há miệng) để giặt, xong thì được phơi lên dây.
// Cảnh tự lật gương video (meta.selfMirror) để chữ trên máy giặt không bị ngược.
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Quality } from "@/core/perf";
import type { EffectProps } from "../types";
import { DEPTH, LaundryScene, type LaundryQuality } from "./scene";

const QUALITY: Record<Quality, LaundryQuality> = {
  high: { clothes: 9, bubbles: 28 },
  medium: { clothes: 7, bubbles: 18 },
  low: { clothes: 5, bubbles: 8 },
};

export default function Effect({ hub, quality, notify, video }: EffectProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const canvas = useThree((s) => s.gl.domElement);
  const scene = useMemo(() => new LaundryScene(video, QUALITY.medium), [video]);

  useEffect(
    () => () => {
      scene.dispose();
      document.body.style.cursor = "";
    },
    [scene],
  );
  useEffect(() => scene.setQuality(QUALITY[quality]), [scene, quality]);
  useEffect(() => {
    scene.onMessage = (m) => notify?.(m);
    return () => {
      scene.onMessage = null;
    };
  }, [scene, notify]);

  useFrame((_, dt) => {
    const h = 2 * DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const w = h * camera.aspect;
    // Khung canvas phủ kín màn hình theo kiểu "cover" nên có thể bị cắt bớt; chỉ bố trí cảnh trong phần nhìn thấy.
    const fx = Math.min(1, window.innerWidth / (canvas.clientWidth || 1));
    const fy = Math.min(1, window.innerHeight / (canvas.clientHeight || 1));
    scene.update(performance.now(), Math.min(dt, 0.1), hub.results.face, hub.results.segmentation, w * fx, h * fy);
  });

  return (
    <primitive
      object={scene.root}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!scene.isButton(e.object)) return;
        e.stopPropagation();
        scene.press(e.object, performance.now(), hub.results.face, hub.results.segmentation);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (scene.isButton(e.object)) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    />
  );
}
