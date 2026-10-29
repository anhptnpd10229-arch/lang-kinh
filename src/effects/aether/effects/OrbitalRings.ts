// Các vòng quỹ đạo mảnh, trong suốt, mỗi vòng nghiêng và quay với tốc độ riêng.
// Trên mỗi vòng có những đốm sáng chạy dọc (như hạt bám quỹ đạo).
import * as THREE from "three";
import { PALETTE } from "../shaders/common";
import type { FxUniforms } from "./uniforms";

const RING_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform float uTime, uFade, uCharge, uIntensity, uRingFade, uSeed, uSpeed;
  varying vec2 vUv;
  ${PALETTE}
  void main() {
    // vUv.x chạy vòng quanh vòng tròn lớn; đốm sáng di chuyển dọc theo đó.
    float a = vUv.x * 6.2831853;
    float sparks = pow(0.5 + 0.5 * sin(a * 5.0 - uTime * uSpeed * 3.0 + uSeed * 10.0), 28.0);
    float shimmer = 0.5 + 0.5 * sin(a * 23.0 + uTime * 4.0 + uSeed * 3.0);
    float base = 0.22 + 0.12 * shimmer;
    vec3 col = mix(ELECTRIC, CYAN, 0.5 + 0.5 * sin(a + uSeed)) * base + HOT * sparks * 2.5;
    col *= 1.0 + uCharge * 1.2;
    gl_FragColor = vec4(col * uRingFade * uFade * uIntensity, 1.0);
  }
`;

type Ring = { pivot: THREE.Group; mesh: THREE.Mesh; spin: number };

export class OrbitalRings {
  /** Nhóm ngoài cùng: xoay theo hướng bàn tay. */
  readonly group = new THREE.Group();
  readonly ringFade = { value: 0 };
  private rings: Ring[] = [];

  constructor(uniforms: FxUniforms) {
    const specs = [
      { r: 1.45, tilt: [1.2, 0.1, 0], spin: 0.9 },
      { r: 1.7, tilt: [0.4, 0.9, 0.3], spin: -0.6 },
      { r: 2.0, tilt: [-0.7, -0.5, 0.2], spin: 0.45 },
    ];
    specs.forEach((s, i) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        uniforms: {
          ...(uniforms as unknown as Record<string, THREE.IUniform>),
          uRingFade: this.ringFade,
          uSeed: { value: i * 1.7 },
          uSpeed: { value: Math.abs(s.spin) * 2 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(s.r, 0.012 + i * 0.004, 6, 200), material);
      const pivot = new THREE.Group();
      pivot.rotation.set(s.tilt[0], s.tilt[1], s.tilt[2]);
      pivot.add(mesh);
      this.group.add(pivot);
      this.rings.push({ pivot, mesh, spin: s.spin });
    });
  }

  /** `speed` nhân thêm khi nạp năng lượng. */
  update(dt: number, speed: number) {
    for (const r of this.rings) r.mesh.rotation.z += r.spin * speed * dt;
  }
}
