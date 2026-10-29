// Ghép các phần của quả cầu và điều khiển chúng theo trạng thái phép thuật + vị trí bàn tay.
// Quả cầu bám lòng bàn tay bằng lò xo–giảm chấn (có quán tính tự nhiên), kích thước theo độ lớn bàn tay.
import * as THREE from "three";
import type { MagicState } from "../magic/MagicStateMachine";
import { NOISE, PALETTE } from "../shaders/common";
import { AuraParticles } from "./AuraParticles";
import { EnergyCore } from "./EnergyCore";
import { LightningSystem, randomUnit } from "./LightningSystem";
import { OrbitalRings } from "./OrbitalRings";
import { Shockwave } from "./Shockwave";
import { createFxUniforms, type AetherQuality } from "./uniforms";

export type SceneInput = {
  state: MagicState;
  /** Tiến độ trạng thái hiện tại (triệu hồi, giải phóng…). */
  progress: number;
  charge: number;
  /** Năng lượng lúc giải phóng (độ mạnh sóng xung kích). */
  releasePower: number;
  presence: number;
  pinching: boolean;
  /** Vị trí mục tiêu của tâm quả cầu (toạ độ cảnh). */
  target: THREE.Vector3;
  /** Bán kính mục tiêu (toạ độ cảnh). */
  radius: number;
  /** Góc nghiêng bàn tay trên màn hình và mức lòng bàn tay hướng vào camera. */
  roll: number;
  facing: number;
  /** Vị trí lòng bàn tay (cho ánh sáng hắt) và đầu ngón cái/trỏ (cho sợi năng lượng khi chụm). */
  palm: THREE.Vector3;
  thumb: THREE.Vector3;
  index: THREE.Vector3;
  /** Tay đang hiện diện (đủ tin cậy) ở khung hình này. */
  tracked: boolean;
};

const SPILL_FRAGMENT = /* glsl */ `
  uniform float uFade, uCharge, uIntensity, uTime;
  varying vec2 vUv;
  ${NOISE}
  ${PALETTE}
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float flick = 0.85 + 0.15 * noise3(vec3(uTime * 6.0, 0.0, 0.0));
    float glow = exp(-r * r * 4.5) * (0.18 + uCharge * 0.4) * flick;
    gl_FragColor = vec4(mix(ELECTRIC, CYAN, 0.6) * glow * uIntensity * uFade, 1.0);
  }
`;

const UV_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Lò xo bám tay: hơi thiếu giảm chấn để có độ "nảy" nhẹ. */
const SPRING_K = 140;
const SPRING_DAMP = 2 * Math.sqrt(SPRING_K) * 0.75;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();

export class EnergyScene {
  readonly root = new THREE.Group();
  readonly uniforms = createFxUniforms();
  /** Số pixel cho 1 đơn vị ở khoảng cách 1 (cho kích thước hạt). */
  readonly pointScale = { value: 600 };

  private orb = new THREE.Group();
  private core: EnergyCore;
  private rings: OrbitalRings;
  private lightning = new LightningSystem();
  private aura: AuraParticles;
  private shock: Shockwave;
  private spill: THREE.Mesh;
  private vel = new THREE.Vector3();
  private radius = 1;
  private placed = false;
  private nextBolt = 0;
  private nextLink = 0;
  private lastState: MagicState = "IDLE";
  private releaseAt = new THREE.Vector3();

  constructor(quality: AetherQuality) {
    this.core = new EnergyCore(this.uniforms, quality.sphereDetail);
    this.rings = new OrbitalRings(this.uniforms);
    this.aura = new AuraParticles(this.pointScale);
    this.shock = new Shockwave(this.pointScale);
    this.spill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: UV_VERTEX,
        fragmentShader: SPILL_FRAGMENT,
        uniforms: this.uniforms as unknown as Record<string, THREE.IUniform>,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.orb.add(this.core.group, this.rings.group, this.aura.points, this.lightning.lines);
    this.root.add(this.spill, this.orb, this.shock.group);
    this.orb.visible = false;
    this.spill.visible = false;
    this.setQuality(quality);
  }

  setQuality(q: AetherQuality) {
    this.aura.setCount(q.particles);
    this.shock.setCount(q.burst);
    this.lightning.setMaxSegments(q.lightningSegments);
  }

  /** Vị trí hiện tại của tâm quả cầu (toạ độ cảnh). */
  get orbPosition() {
    return this.orb.position;
  }

  reset() {
    this.placed = false;
    this.vel.set(0, 0, 0);
    this.lightning.clear();
    this.aura.scatter();
  }

  update(now: number, dt: number, input: SceneInput, camera: THREE.Camera) {
    const time = now / 1000;
    const u = this.uniforms;
    u.uTime.value = time;

    const { state } = input;
    if (state === "SUMMONING" && this.lastState !== "SUMMONING") this.aura.scatter();
    if (state === "RELEASE" && this.lastState !== "RELEASE") this.burst(now, input);
    this.lastState = state;

    // ----- Bám tay -----
    const live = state === "SUMMONING" || state === "ACTIVE" || state === "CHARGING";
    if (input.tracked && (!this.placed || state === "IDLE" || state === "COOLDOWN")) {
      // Chưa có quả cầu: đặt thẳng vào tay để lần triệu hồi sau không bay từ chỗ cũ tới.
      this.orb.position.copy(input.target);
      this.vel.set(0, 0, 0);
      this.radius = input.radius;
      this.placed = true;
    } else if (input.tracked && live) {
      // Khi chụm: quả cầu "ổn định" — lò xo cứng hơn, ít nảy.
      const k = input.pinching ? SPRING_K * 1.6 : SPRING_K;
      const c = input.pinching ? SPRING_DAMP * 1.6 : SPRING_DAMP;
      tmp.subVectors(input.target, this.orb.position).multiplyScalar(k).addScaledVector(this.vel, -c);
      this.vel.addScaledVector(tmp, dt);
      this.orb.position.addScaledVector(this.vel, dt);
      this.radius += (input.radius - this.radius) * Math.min(1, dt * 6);
    } else {
      // Mất tay: trôi chậm lại tại chỗ trong lúc mờ dần, không đứng hình.
      this.vel.multiplyScalar(Math.exp(-dt * 4));
      this.orb.position.addScaledVector(this.vel, dt);
    }

    // ----- Thông số theo trạng thái -----
    const summon = state === "SUMMONING" ? input.progress : live ? 1 : 0;
    const formed = smooth(Math.min(1, summon * 1.4 - 0.25));
    const charge = input.charge;
    const sizeK = state === "CHARGING" ? 1 - 0.4 * charge : 1;
    const visible = live && input.presence > 0.01;
    const releasing = state === "RELEASE";

    // Lúc giải phóng, lõi/vòng/hạt biến mất (năng lượng đã phóng đi) nhưng sét toả ra vẫn cần nhóm quả cầu.
    this.orb.visible = visible || releasing;
    this.core.group.visible = this.rings.group.visible = this.aura.points.visible = visible;
    this.orb.scale.setScalar(releasing ? this.radius : this.radius * sizeK * Math.max(0.001, formed));
    // Hạt vẫn hiện trước khi lõi thành hình (đang hội tụ), nên đặt tỉ lệ riêng cho hạt.
    this.aura.points.scale.setScalar(1 / Math.max(0.001, formed * sizeK) * (state === "SUMMONING" ? 1 : sizeK));
    u.uFade.value = input.presence;
    u.uCharge.value = charge;
    // Nạp làm lõi gắt hơn nhưng có giới hạn, để tia sét và vòng quỹ đạo không bị nuốt trong vùng cháy sáng.
    u.uIntensity.value = (1 + (input.pinching ? 0.25 : 0) + charge * 0.35) *(0.8 + 0.2 * Math.sin(time * 9 + Math.sin(time * 3.1) * 2));
    this.rings.ringFade.value = smooth(Math.min(1, Math.max(0, (summon - 0.4) / 0.6)));
    this.aura.fade.value = input.presence * (state === "SUMMONING" ? Math.min(1, summon * 3) : 1);

    // Vòng quỹ đạo nghiêng theo cổ tay.
    const g = this.rings.group;
    g.rotation.z += (-input.roll - g.rotation.z) * Math.min(1, dt * 8);
    g.rotation.x += ((1 - input.facing) * 0.9 - g.rotation.x) * Math.min(1, dt * 5);
    this.rings.update(dt, 1 + charge * 4);
    this.core.halo.quaternion.copy(camera.quaternion).premultiply(tmpQuat.copy(this.orb.quaternion).invert());

    if (visible) {
      this.aura.update(time, dt, summon, charge, 1);
      this.spawnLightning(now, input, charge);
    }
    this.lightning.update(now, live ? input.presence : 1);
    this.shock.update(now, dt, camera);

    // Ánh sáng hắt lên lòng bàn tay.
    this.spill.visible = visible && formed > 0.2;
    this.spill.position.copy(input.palm).setZ(input.palm.z + 0.5);
    this.spill.scale.setScalar(this.radius * 5);
    this.spill.quaternion.copy(camera.quaternion);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.lightning.dispose();
    this.aura.dispose();
    this.shock.dispose();
  }

  private spawnLightning(now: number, input: SceneInput, charge: number) {
    // Tần suất tia: ít khi yên, dồn dập khi nạp.
    const rate = input.state === "CHARGING" ? 5 + charge * 30 : input.state === "SUMMONING" ? 3 : 4;
    if (now >= this.nextBolt) {
      this.nextBolt = now + (1000 / rate) * (0.5 + Math.random());
      // Tia phải vươn ra ngoài vùng sáng của lõi mới thấy được; khi nạp, tia dài và phân nhánh nhiều hơn.
      // Quả cầu co lại khi nạp (thu nhỏ cả toạ độ cục bộ), nên chia cho hệ số co để tia vẫn vươn ra ngoài.
      const shrink = input.state === "CHARGING" ? 1 - 0.4 * charge : 1;
      const reach = (input.state === "CHARGING" ? 1.8 + Math.random() * (1.2 + charge) : 1.5 + Math.random() * 1.2) / shrink;
      const from = randomUnit(tmp).multiplyScalar(0.3);
      const to = randomUnit(tmp2).multiplyScalar(reach);
      this.lightning.spawn(from.clone(), to.clone(), now, { branches: 1 + Math.floor(Math.random() * (2 + charge * 3)), power: 0.8 + charge * 0.6 });
    }
    // Sợi năng lượng nối đầu ngón cái và ngón trỏ với quả cầu khi chụm.
    if (input.pinching && now >= this.nextLink) {
      this.nextLink = now + 55;
      for (const tip of [input.thumb, input.index]) {
        this.orb.worldToLocal(tmp.copy(tip));
        this.lightning.spawn(ORIGIN, tmp.clone(), now, { jitter: 0.12, branches: 0, life: 90, power: 0.55 });
      }
    }
  }

  private burst(now: number, input: SceneInput) {
    this.releaseAt.copy(this.orb.position);
    const power = Math.max(0.3, input.releasePower);
    this.shock.trigger(this.releaseAt, this.radius, power, now);
    // Sét phân nhánh toả ra xa rồi tắt dần.
    for (let i = 0; i < 10; i++) {
      this.lightning.spawn(ORIGIN, randomUnit(tmp).multiplyScalar(3 + Math.random() * 4).clone(), now, {
        branches: 3,
        jitter: 0.32,
        life: 260 + Math.random() * 260,
        power: 1.6,
      });
    }
  }
}

const tmpQuat = new THREE.Quaternion();
const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
