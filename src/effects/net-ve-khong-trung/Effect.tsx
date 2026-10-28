"use client";

// "Nét Vẽ Không Trung": chụm ngón tay để vẽ những nét sáng 2D lên khung hình, kèm các cử chỉ
// đổi bút, kéo, xoay/phóng, nhảy, hoàn tác và xoá. Trạng thái nằm trong AirStudio (three.js thuần).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Quality } from "@/core/perf";
import type { EffectProps } from "../types";
import { AirStudio, DEPTH, type Brush, type StudioEvent, type StudioQuality } from "./studio";

const QUALITY: Record<Quality, StudioQuality> = {
  high: { radial: 8, maxStrokes: 20, halo: true },
  medium: { radial: 6, maxStrokes: 14, halo: true },
  low: { radial: 4, maxStrokes: 8, halo: false },
};

const BRUSH_LABEL: Record<Brush, string> = { neon: "Neon", sparkle: "Bụi sao", rainbow: "Cầu vồng" };

function message(e: StudioEvent): string | null {
  switch (e.type) {
    case "pen":
      return e.on ? "3️⃣ Bút bật — chụm tay để vẽ" : "Bút tắt — giơ 3 ngón để bật lại";
    case "brush":
      return `✌️ Bút: ${BRUSH_LABEL[e.brush]}`;
    case "dance":
      return "👍 Nhảy nào!";
    case "undo":
      return "👎 Hoàn tác";
    case "clear":
      return "🖐 Đã xoá";
    case "transform":
      return "🤏🤏 Xoay hoặc kéo giãn hai tay để biến đổi";
    default:
      return null;
  }
}

export default function Effect({ hub, quality, notify }: EffectProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const studio = useMemo(() => new AirStudio(QUALITY.medium), []);

  useEffect(() => () => studio.dispose(), [studio]);
  useEffect(() => studio.setQuality(QUALITY[quality]), [studio, quality]);
  useEffect(() => {
    studio.onEvent = (e) => {
      const text = message(e);
      if (text) notify?.(text);
    };
    return () => {
      studio.onEvent = null;
    };
  }, [studio, notify]);

  useFrame(() => {
    const h = 2 * DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    studio.update(hub.results.hand, hub.results.timestamp, performance.now(), h * camera.aspect, h);
  });

  return <primitive object={studio.root} />;
}
