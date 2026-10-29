// Lõi năng lượng: ba lớp chồng lên nhau, cộng sáng.
// 1) Lõi trong: plasma cuộn (fbm) với tâm trắng nóng.
// 2) Vỏ ngoài: bề mặt gợn sóng theo nhiễu, sáng ở viền (fresnel), pha chút tím.
// 3) Quầng sáng: mặt phẳng luôn quay về camera, toả sáng mềm như ánh sáng thể tích.
import * as THREE from "three";
import { NOISE, PALETTE } from "../shaders/common";
import type { FxUniforms } from "./uniforms";

const CORE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORE_FRAGMENT = /* glsl */ `
  uniform float uTime, uFade, uCharge, uIntensity;
  varying vec3 vNormal;
  varying vec3 vPos;
  ${NOISE}
  ${PALETTE}
  void main() {
    float facing = max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
    float swirl = fbm(vPos * 3.2 + vec3(uTime * 0.7, -uTime * 0.9, uTime * 0.5));
    float filaments = smoothstep(0.55, 0.75, fbm(vPos * 7.0 - uTime * 1.6));
    float hotSpot = pow(facing, 2.5 - uCharge * 0.8);
    vec3 col = mix(CYAN * 1.6, HOT * 4.0, hotSpot) * (0.55 + swirl * 0.9);
    col += HOT * filaments * 1.5;
    gl_FragColor = vec4(col * uIntensity * uFade, 1.0);
  }
`;

const SHELL_VERTEX = /* glsl */ `
  uniform float uTime, uCharge;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  ${NOISE}
  void main() {
    float n = fbm(position * 2.2 + vec3(0.0, uTime * 0.8, uTime * 0.4));
    vec3 p = position + normal * (n - 0.5) * (0.18 + uCharge * 0.25);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vPos = p;
    gl_Position = projectionMatrix * mv;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform float uTime, uFade, uCharge, uIntensity;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  ${NOISE}
  ${PALETTE}
  void main() {
    float rim = pow(max(0.0, 1.0 - abs(dot(vNormal, vView))), 2.2);
    float bands = smoothstep(0.45, 0.9, fbm(vPos * 4.0 + vec3(uTime * 1.3, 0.0, -uTime)));
    vec3 col = mix(ELECTRIC, CYAN, rim) * rim * 2.2 + CYAN * bands * 0.6 + VIOLET * rim * rim * 0.5;
    col *= 1.0 + uCharge * 0.3;
    gl_FragColor = vec4(col * uIntensity * uFade, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform float uFade, uCharge, uIntensity;
  varying vec2 vUv;
  ${PALETTE}
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float glow = exp(-r * r * 9.0) * 0.22 + exp(-r * 16.0) * 0.35;
    gl_FragColor = vec4(mix(CYAN, HOT, exp(-r * 8.0)) * glow * (0.6 + uCharge * 0.4) * uIntensity * uFade, 1.0);
  }
`;

const UV_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const additive = (vertexShader: string, fragmentShader: string, uniforms: FxUniforms, extra: Partial<THREE.ShaderMaterialParameters> = {}) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    ...extra,
  });

export class EnergyCore {
  readonly group = new THREE.Group();
  /** Quầng sáng cần quay về phía camera mỗi khung hình. */
  readonly halo: THREE.Mesh;

  constructor(uniforms: FxUniforms, detail: number) {
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.42, detail, detail / 2), additive(CORE_VERTEX, CORE_FRAGMENT, uniforms));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, detail, detail / 2), additive(SHELL_VERTEX, SHELL_FRAGMENT, uniforms));
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), additive(UV_VERTEX, HALO_FRAGMENT, uniforms));
    inner.renderOrder = 2;
    shell.renderOrder = 1;
    this.halo.renderOrder = 0;
    this.group.add(this.halo, shell, inner);
  }
}
