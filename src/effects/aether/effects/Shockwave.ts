// Sóng xung kích khi giải phóng: vòng sáng nở cực nhanh (có méo theo nhiễu), vỏ cầu nở ra mờ dần,
// và một chùm hạt văng ra rồi chậm lại. Đặt ở toạ độ cảnh (không xoay theo quả cầu).
import * as THREE from "three";
import { NOISE, PALETTE } from "../shaders/common";
import { particleMaterial } from "./particleMaterial";
import { MAX_BURST } from "./uniforms";

const RING_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform float uProgress, uPower, uTime;
  varying vec2 vUv;
  ${NOISE}
  ${PALETTE}
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float ang = atan(p.y, p.x);
    float e = 1.0 - pow(1.0 - uProgress, 3.0);
    float edge = e + (noise3(vec3(ang * 3.0, uTime * 4.0, 0.0)) - 0.5) * 0.06;
    float width = mix(0.02, 0.07, e);
    // Bình phương bằng phép nhân: pow() với cơ số âm cho NaN trên GPU và làm hỏng điểm ảnh bên trong vòng.
    float k = (r - edge) / width;
    float band = exp(-k * k);
    // smoothstep với cận đảo ngược (cận dưới > cận trên) không được GLSL định nghĩa và ra rác trên ANGLE/D3D.
    float inner = (1.0 - smoothstep(0.0, max(edge, 1e-3), r)) * 0.2 * (1.0 - e);
    float life = pow(1.0 - uProgress, 1.6);
    vec3 col = mix(HOT * 1.5, CYAN * 1.1, e) * band + ELECTRIC * inner;
    gl_FragColor = vec4(col * life * uPower, 1.0);
  }
`;

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform float uProgress, uPower;
  varying vec3 vNormal;
  varying vec3 vView;
  ${PALETTE}
  void main() {
    float rim = pow(max(0.0, 1.0 - abs(dot(vNormal, vView))), 3.0);
    gl_FragColor = vec4(CYAN * rim * 0.7 * pow(1.0 - uProgress, 2.0) * uPower, 1.0);
  }
`;

const RING_MS = 650;
const SHELL_MS = 900;
const BURST_MS = 1400;

export class Shockwave {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private burst: THREE.Points;
  private burstFade = { value: 0 };
  private burstPos = new Float32Array(MAX_BURST * 3);
  private burstVel = new Float32Array(MAX_BURST * 3);
  private burstCount = MAX_BURST;
  private startedAt = -Infinity;
  private uniforms = { uProgress: { value: 1 }, uPower: { value: 1 }, uTime: { value: 0 } };

  constructor(scale: { value: number }) {
    const mat = (vertexShader: string, fragmentShader: string) =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat(RING_VERTEX, RING_FRAGMENT));
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), mat(SHELL_VERTEX, SHELL_FRAGMENT));
    this.shell.material.uniforms = { uProgress: { value: 1 }, uPower: this.uniforms.uPower };

    const geo = new THREE.BufferGeometry();
    const size = new Float32Array(MAX_BURST);
    const bright = new Float32Array(MAX_BURST);
    for (let i = 0; i < MAX_BURST; i++) {
      size[i] = 0.03 + Math.pow(Math.random(), 3) * 0.12;
      bright[i] = 0.4 + Math.random() * 0.8;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(this.burstPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
    this.burst = new THREE.Points(geo, particleMaterial(this.burstFade, scale));
    this.burst.frustumCulled = false;
    this.group.add(this.shell, this.ring, this.burst);
    this.group.visible = false;
  }

  setCount(n: number) {
    this.burstCount = Math.min(n, MAX_BURST);
    this.burst.geometry.setDrawRange(0, this.burstCount);
  }

  get active() {
    return this.group.visible;
  }

  /** Kích hoạt tại vị trí `at` (toạ độ cảnh) với bán kính quả cầu `radius`. */
  trigger(at: THREE.Vector3, radius: number, power: number, now: number) {
    this.startedAt = now;
    this.group.position.copy(at);
    this.group.scale.setScalar(radius);
    this.group.visible = true;
    this.uniforms.uPower.value = 0.6 + power * 0.8;
    for (let i = 0; i < this.burstCount; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const v = (6 + Math.random() * 16) * (0.7 + power * 0.5);
      this.burstPos.fill(0, i * 3, i * 3 + 3);
      this.burstVel[i * 3] = s * Math.cos(t) * v;
      this.burstVel[i * 3 + 1] = s * Math.sin(t) * v;
      this.burstVel[i * 3 + 2] = u * v * 0.4;
    }
  }

  update(now: number, dt: number, camera: THREE.Camera) {
    if (!this.group.visible) return;
    const t = now - this.startedAt;
    if (t > BURST_MS) {
      this.group.visible = false;
      return;
    }
    this.uniforms.uTime.value = now / 1000;
    this.uniforms.uProgress.value = Math.min(1, t / RING_MS);
    this.ring.visible = t < RING_MS;
    this.ring.scale.setScalar(9);
    this.ring.quaternion.copy(camera.quaternion);
    const s = Math.min(1, t / SHELL_MS);
    this.shell.visible = s < 1;
    this.shell.scale.setScalar(1 + (1 - Math.pow(1 - s, 3)) * 5);
    this.shell.material.uniforms.uProgress.value = s;

    const drag = Math.exp(-dt * 2.2);
    for (let i = 0; i < this.burstCount * 3; i++) {
      this.burstVel[i] *= drag;
      this.burstPos[i] += this.burstVel[i] * dt;
    }
    this.burst.geometry.attributes.position.needsUpdate = true;
    // Hạt dồn sát nhau ngay sau vụ nổ sẽ cộng sáng thành sương trắng, nên cho chúng sáng dần khi đã tản ra.
    const spread = Math.min(1, t / 250);
    this.burstFade.value = 0.6 * spread * Math.pow(1 - t / BURST_MS, 1.5);
  }

  dispose() {
    for (const m of [this.ring, this.shell, this.burst]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
