// Uniform dùng chung cho mọi vật liệu của quả cầu (cùng một object nên chỉ cần cập nhật một chỗ).
export type FxUniforms = {
  uTime: { value: number };
  /** Độ hiện diện 0→1 (mờ dần khi mất tay). */
  uFade: { value: number };
  /** Mức nạp 0→1. */
  uCharge: { value: number };
  /** Độ sáng tổng (tăng khi chụm, khi nạp). */
  uIntensity: { value: number };
};

export const createFxUniforms = (): FxUniforms => ({
  uTime: { value: 0 },
  uFade: { value: 0 },
  uCharge: { value: 0 },
  uIntensity: { value: 1 },
});

export type AetherQuality = {
  particles: number;
  burst: number;
  lightningSegments: number;
  /** Tỉ lệ độ phân giải render target hiệu ứng so với canvas. */
  fxScale: number;
  sphereDetail: number;
};

export const AETHER_QUALITY: Record<"high" | "medium" | "low", AetherQuality> = {
  high: { particles: 1400, burst: 520, lightningSegments: 1400, fxScale: 1, sphereDetail: 64 },
  medium: { particles: 800, burst: 320, lightningSegments: 800, fxScale: 0.8, sphereDetail: 48 },
  low: { particles: 350, burst: 160, lightningSegments: 400, fxScale: 0.6, sphereDetail: 32 },
};

export const MAX_PARTICLES = AETHER_QUALITY.high.particles;
export const MAX_BURST = AETHER_QUALITY.high.burst;
export const MAX_LIGHTNING_SEGMENTS = AETHER_QUALITY.high.lightningSegments;
