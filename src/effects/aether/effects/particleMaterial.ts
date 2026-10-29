// Vật liệu hạt dùng chung cho hào quang và vụ nổ: điểm tròn mềm, cộng sáng, kích thước theo khoảng cách.
import * as THREE from "three";
import { PALETTE } from "../shaders/common";

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  uniform float uScale;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vBright = aBright;
    // uScale = số pixel ứng với 1 đơn vị ở khoảng cách 1; nhân thêm tỉ lệ của object (quả cầu to/nhỏ).
    float objScale = length(modelMatrix[0].xyz);
    gl_PointSize = max(1.0, aSize * objScale * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uFade;
  varying float vBright;
  ${PALETTE}
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = exp(-dot(d, d) * 18.0);
    vec3 col = mix(CYAN, HOT, clamp(vBright - 0.6, 0.0, 1.0)) * vBright * 1.1;
    gl_FragColor = vec4(col * a * uFade, 1.0);
  }
`;

export function particleMaterial(fade: { value: number }, scale: { value: number }) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uFade: fade, uScale: scale },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}
