// Đoạn GLSL dùng chung: nhiễu giá trị 3D + fbm (đủ cho plasma, không cần simplex đầy đủ).
// Mọi shader của AETHER xuất màu tuyến tính, có thể > 1 (render target half-float), để bloom bắt được lõi sáng.

export const NOISE = /* glsl */ `
  float hash13(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

/** Bảng màu: lõi trắng nóng, cyan, xanh điện, chút tím. */
export const PALETTE = /* glsl */ `
  const vec3 HOT = vec3(1.0, 0.98, 0.95);
  const vec3 CYAN = vec3(0.25, 0.85, 1.0);
  const vec3 ELECTRIC = vec3(0.12, 0.38, 1.0);
  const vec3 VIOLET = vec3(0.45, 0.25, 1.0);
`;
