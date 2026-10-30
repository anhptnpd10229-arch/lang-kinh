// Cảnh giáp: đặt các mảnh giáp theo khớp cơ thể, dàn dựng chuỗi biến hình (cột sáng, hạt xoáy,
// giáp bay tới gắn từng mảnh, tia lửa khi gắn, chớp sáng), bùng năng lượng và tháo giáp.
// Canvas được lật gương bằng CSS cùng video, nên toạ độ ở đây là toạ độ ảnh gốc.
import * as THREE from "three";
import type { ArmorState } from "../magic/TransformMachine";
import { chestPlate, createMaterials, dotTexture, gauntlet, helmet, shoulderPad, type Gauntlet } from "./ArmorParts";

/** Khớp cơ thể đã làm mượt, ở toạ độ cảnh. */
export type Rig = {
  shL: THREE.Vector3;
  shR: THREE.Vector3;
  elL: THREE.Vector3;
  elR: THREE.Vector3;
  wrL: THREE.Vector3;
  wrR: THREE.Vector3;
  head: THREE.Vector3;
  headW: number;
  headRoll: number;
  headYaw: number;
  headVisible: boolean;
  armsVisible: boolean;
  sw: number;
};

export type ArmorQuality = { spiral: number; sparks: number };

type PieceKind = "chest" | "padL" | "padR" | "gauntL" | "gauntR" | "helmet";
type Piece = {
  kind: PieceKind;
  group: THREE.Group;
  /** Thời điểm gắn vào người, tính từ lúc bắt đầu biến hình (ms). */
  arrive: number;
  /** Hướng bay tới (và bay đi khi tháo giáp), theo đơn vị độ rộng vai. */
  from: THREE.Vector3;
  landed: boolean;
  gauntlet?: Gauntlet;
};

const FLY_MS = 480;
const VISOR_ON_MS = 2350;
const SPARK_LIFE_MS = 650;
const RING_MS = 650;
const BASE_GLOW = new THREE.Color("#8ff7e4");

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class ArmorScene {
  readonly root = new THREE.Group();
  onLand: ((kind: PieceKind) => void) | null = null;

  private mats = createMaterials();
  private pieces: Piece[] = [];
  private presence = 0;
  private dot = dotTexture();
  private pillar: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private spiral: THREE.Points;
  private spiralPos: Float32Array;
  private spiralSeed: Float32Array;
  private sparks: THREE.Points;
  private sparkPos: Float32Array;
  private sparkVel: Float32Array;
  private sparkBorn: Float32Array;
  private sparkCursor = 0;
  private ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private ringAt = -Infinity;
  private flash: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private flashLevel = 0;
  private boost = 0;
  private quality: ArmorQuality;
  private lastState: ArmorState = "IDLE";

  constructor(quality: ArmorQuality) {
    this.quality = quality;
    const m = this.mats;
    const add = (kind: PieceKind, group: THREE.Group, arrive: number, from: [number, number, number], g?: Gauntlet) => {
      group.visible = false;
      this.root.add(group);
      this.pieces.push({ kind, group, arrive, from: new THREE.Vector3(...from), landed: false, gauntlet: g });
    };
    add("chest", chestPlate(m), 700, [0, -1.5, 9]);
    add("padL", shoulderPad(m), 950, [3, 1.5, 3]);
    add("padR", shoulderPad(m), 1100, [-3, 1.5, 3]);
    const gl = gauntlet(m);
    const gr = gauntlet(m);
    add("gauntL", gl.group, 1300, [3.5, -1, 2], gl);
    add("gauntR", gr.group, 1450, [-3.5, -1, 2], gr);
    add("helmet", helmet(m), 1850, [0, 4, 1]);

    // Cột sáng phía sau người lúc biến hình.
    this.pillar = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uLevel: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uLevel; varying vec2 vUv;
          void main(){
            float x = abs(vUv.x - 0.5) * 2.0;
            float core = exp(-x * x * 18.0);
            float halo = exp(-x * x * 3.0) * 0.35;
            float fade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
            vec3 col = mix(vec3(0.55, 0.45, 1.0), vec3(0.85, 1.0, 0.97), core);
            // Canvas trong suốt nằm trên video: alpha phải bằng độ sáng, nếu ghi 1.0 thì phần tối thành khối đen đục.
            float a = clamp((core + halo) * fade * uLevel, 0.0, 1.0);
            gl_FragColor = vec4(col, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.pillar.renderOrder = -1;
    this.root.add(this.pillar);

    // Hạt xoáy quanh người.
    const n = 900;
    this.spiralPos = new Float32Array(n * 3);
    this.spiralSeed = Float32Array.from({ length: n * 3 }, () => Math.random());
    this.spiral = this.points(this.spiralPos, "#bfb1ff", 0.9);
    // Tia lửa khi gắn giáp / bùng năng lượng.
    const s = 400;
    this.sparkPos = new Float32Array(s * 3);
    this.sparkVel = new Float32Array(s * 3);
    this.sparkBorn = new Float32Array(s).fill(-1e9);
    this.sparks = this.points(this.sparkPos, "#9ff9e8", 0.7);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.03, 8, 64),
      new THREE.MeshBasicMaterial({ color: "#c9b9ff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.ring.visible = false;
    this.root.add(this.ring);

    // Chớp sáng toàn màn hình: tấm phẳng sát camera.
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.flash.position.z = -1.5;
    this.flash.renderOrder = 10;
    this.root.add(this.flash);
    this.setQuality(quality);
  }

  setQuality(q: ArmorQuality) {
    this.quality = q;
    this.spiral.geometry.setDrawRange(0, q.spiral);
  }

  /** Gọi khi máy trạng thái phát sự kiện "power". */
  power(now: number, rig: Rig | null) {
    this.boost = 1;
    this.flashLevel = Math.max(this.flashLevel, 0.35);
    if (!rig) return;
    this.ringAt = now;
    this.chestCenter(rig, tmp);
    this.burst(tmp, Math.round(this.quality.sparks * 0.4), rig.sw * 2.2, now);
  }

  update(now: number, dt: number, rig: Rig | null, state: ArmorState, stateSince: number) {
    const t = now - stateSince;
    if (state !== this.lastState) {
      if (state === "TRANSFORMING") this.pieces.forEach((p) => (p.landed = false));
      if (state === "ARMORED") this.flashLevel = 0.55;
      this.lastState = state;
    }

    const tracked = !!rig;
    this.presence += ((tracked ? 1 : 0) - this.presence) * Math.min(1, dt * (tracked ? 6 : 3));
    this.boost = Math.max(0, this.boost - dt * 1.4);

    // Lõi giáp ngực và kính mũ "thở" nhẹ, bừng lên khi bùng năng lượng.
    const visorOn = state === "ARMORED" || (state === "TRANSFORMING" && t > VISOR_ON_MS);
    const pulse = 1 + 0.18 * Math.sin(now / 320) + this.boost * 1.6;
    this.mats.glow.color.copy(BASE_GLOW).multiplyScalar(pulse);

    if (rig) this.placePieces(now, rig, state, t, visorOn);
    for (const p of this.pieces) if (!rig) p.group.visible = p.group.visible && this.presence > 0.05;

    this.updateTransformFx(now, rig, state, t);
    this.updateSparks(now, dt);
    this.updateRing(now, rig);
    this.flashLevel = Math.max(0, this.flashLevel - dt * 2.2);
    this.flash.material.opacity = this.flashLevel * this.flashLevel;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    });
    Object.values(this.mats).forEach((m) => m.dispose());
    for (const o of [this.pillar, this.spiral, this.sparks, this.ring, this.flash]) (o.material as THREE.Material).dispose();
    this.dot.dispose();
  }

  // ---------- Đặt giáp ----------

  private placePieces(now: number, rig: Rig, state: ArmorState, t: number, visorOn: boolean) {
    const sw = rig.sw;
    for (const p of this.pieces) {
      const g = p.group;
      if (!this.targetFor(p, rig, g)) {
        g.visible = false;
        continue;
      }
      const baseScale = g.scale.x;
      let show = false;
      let k = 1; // 1 = đã gắn vào người; 0 = còn ở xa
      if (state === "TRANSFORMING") {
        const local = t - (p.arrive - FLY_MS);
        if (local > 0) {
          show = true;
          k = Math.min(1, local / FLY_MS);
          if (k >= 1 && !p.landed) {
            p.landed = true;
            this.burst(g.position, Math.round(this.quality.sparks * 0.18), sw * 1.4, now);
            this.onLand?.(p.kind);
          }
        }
      } else if (state === "ARMORED") {
        show = true;
      } else if (state === "DETRANSFORMING") {
        show = true;
        k = 1 - Math.min(1, t / 700);
      }
      if (!show || k <= 0.001) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      // Bay theo đường cong từ xa tới, vừa bay vừa xoay; khi tháo giáp thì bay ngược ra và thu nhỏ.
      const e = state === "DETRANSFORMING" ? k * k : 1 - Math.pow(1 - k, 3);
      tmp.copy(p.from).multiplyScalar(sw * (1 - e));
      g.position.add(tmp);
      g.rotation.y += (1 - e) * Math.PI * 1.5;
      const grow = state === "DETRANSFORMING" ? e : 0.3 + 0.7 * e;
      g.scale.setScalar(baseScale * grow * this.presence);
      if (p.kind === "helmet") {
        const visor = g.getObjectByName("visor");
        if (visor) visor.visible = visorOn;
      }
    }
  }

  /** Đặt vị trí/hướng/tỉ lệ "đã gắn" của mảnh giáp; trả về false nếu khớp liên quan không thấy. */
  private targetFor(p: Piece, rig: Rig, g: THREE.Group): boolean {
    const sw = rig.sw;
    g.rotation.set(0, 0, 0);
    switch (p.kind) {
      case "chest": {
        tmp.addVectors(rig.shL, rig.shR).multiplyScalar(0.5);
        g.position.set(tmp.x, tmp.y, tmp.z + 0.05 * sw);
        g.rotation.z = Math.atan2(rig.shL.y - rig.shR.y, rig.shL.x - rig.shR.x);
        g.scale.setScalar(sw * 1.05);
        return true;
      }
      case "padL":
      case "padR": {
        const L = p.kind === "padL";
        const sh = L ? rig.shL : rig.shR;
        const el = L ? rig.elL : rig.elR;
        // Trục vòm hướng ngược về phía khuỷu tay (lên trên, ra ngoài).
        tmp.subVectors(sh, el);
        if (tmp.lengthSq() < 1e-6) tmp.set(0, 1, 0);
        tmp.normalize();
        g.position.copy(sh).addScaledVector(tmp, -0.04 * sw);
        g.position.z += 0.12 * sw;
        g.rotation.z = Math.atan2(tmp.y, tmp.x) - Math.PI / 2;
        g.scale.setScalar(sw);
        return true;
      }
      case "gauntL":
      case "gauntR": {
        if (!rig.armsVisible || !p.gauntlet) return false;
        const L = p.kind === "gauntL";
        const el = L ? rig.elL : rig.elR;
        const wr = L ? rig.wrL : rig.wrR;
        tmp2.subVectors(wr, el);
        const len = tmp2.length() / sw;
        if (len < 0.05) return false;
        g.position.copy(el).addScaledVector(tmp2, 0.55);
        g.position.z += 0.08 * sw;
        g.rotation.z = Math.atan2(tmp2.y, tmp2.x) - Math.PI / 2;
        g.scale.setScalar(sw);
        // Ống giáp dài theo cẳng tay thật; vòng sáng nằm ở phía cổ tay.
        const L2 = len * 0.8;
        const ga = p.gauntlet;
        ga.body.scale.y = L2;
        ga.bandA.position.y = -L2 / 2 + 0.03;
        ga.bandB.position.y = L2 / 2 - 0.05;
        ga.glow.position.y = L2 / 2 + 0.02;
        return true;
      }
      case "helmet": {
        if (!rig.headVisible) return false;
        g.position.copy(rig.head);
        g.position.z += 0.2 * rig.headW;
        g.rotation.set(0, rig.headYaw, rig.headRoll);
        g.scale.setScalar(rig.headW);
        return true;
      }
    }
  }

  // ---------- Hiệu ứng biến hình ----------

  private chestCenter(rig: Rig, out: THREE.Vector3) {
    return out.addVectors(rig.shL, rig.shR).multiplyScalar(0.5).add(tmp2.set(0, -0.45 * rig.sw, 0.2 * rig.sw));
  }

  private updateTransformFx(now: number, rig: Rig | null, state: ArmorState, t: number) {
    const active = state === "TRANSFORMING" && !!rig;
    // Cột sáng và hạt xoáy: hiện nhanh, giữ, rồi tắt dần trước khi mũ giáp hạ xuống.
    const env = active ? smooth(t / 450) * (1 - smooth((t - 1700) / 600)) : 0;
    const u = this.pillar.material.uniforms;
    u.uLevel.value = env;
    this.pillar.visible = env > 0.001;
    this.spiral.visible = env > 0.001;
    if (!active || env <= 0.001 || !rig) return;

    const sw = rig.sw;
    const c = this.chestCenter(rig, tmp);
    this.pillar.position.set(c.x, c.y + sw * 0.8, c.z - sw);
    this.pillar.scale.set(sw * 2.6, sw * 6, 1);

    const n = this.quality.spiral;
    const height = sw * 4.5;
    const bottom = c.y - sw * 2.2;
    for (let i = 0; i < n; i++) {
      const a = this.spiralSeed[i * 3];
      const b = this.spiralSeed[i * 3 + 1];
      const r = this.spiralSeed[i * 3 + 2];
      const rise = (t / 1000) * (0.45 + a * 0.5) + b;
      const yy = bottom + (rise % 1) * height;
      const ang = b * Math.PI * 2 + (t / 1000) * (3 + a * 3);
      const rad = sw * (1 + r * 0.5) * (1 - 0.35 * smooth(t / 1600));
      this.spiralPos[i * 3] = c.x + Math.cos(ang) * rad;
      this.spiralPos[i * 3 + 1] = yy;
      this.spiralPos[i * 3 + 2] = c.z + Math.sin(ang) * rad * 0.6;
    }
    this.spiral.geometry.attributes.position.needsUpdate = true;
    (this.spiral.material as THREE.PointsMaterial).size = sw * 0.12;
    (this.spiral.material as THREE.PointsMaterial).opacity = env;
    if (t < 500) this.flashLevel = Math.max(this.flashLevel, 0.18 * (1 - t / 500));
  }

  private burst(at: THREE.Vector3, n: number, speed: number, now: number) {
    const total = this.sparkBorn.length;
    for (let k = 0; k < n; k++) {
      const i = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % total;
      this.sparkBorn[i] = now;
      this.sparkPos[i * 3] = at.x;
      this.sparkPos[i * 3 + 1] = at.y;
      this.sparkPos[i * 3 + 2] = at.z;
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const v = speed * (0.4 + Math.random());
      this.sparkVel[i * 3] = s * Math.cos(th) * v;
      this.sparkVel[i * 3 + 1] = s * Math.sin(th) * v + speed * 0.3;
      this.sparkVel[i * 3 + 2] = u * v * 0.5;
    }
  }

  private updateSparks(now: number, dt: number) {
    const total = this.sparkBorn.length;
    let alive = 0;
    const gravity = 40;
    for (let i = 0; i < total; i++) {
      const age = now - this.sparkBorn[i];
      if (age > SPARK_LIFE_MS) {
        // Đẩy hạt đã tắt ra xa phía sau camera để không hiện.
        this.sparkPos[i * 3 + 2] = 1000;
        continue;
      }
      alive++;
      this.sparkVel[i * 3 + 1] -= gravity * dt;
      for (let a = 0; a < 3; a++) this.sparkPos[i * 3 + a] += this.sparkVel[i * 3 + a] * dt;
    }
    this.sparks.visible = alive > 0;
    this.sparks.geometry.attributes.position.needsUpdate = true;
  }

  private updateRing(now: number, rig: Rig | null) {
    const t = (now - this.ringAt) / RING_MS;
    this.ring.visible = t >= 0 && t < 1 && !!rig;
    if (!this.ring.visible || !rig) return;
    this.chestCenter(rig, tmp);
    this.ring.position.copy(tmp);
    this.ring.scale.setScalar(rig.sw * (0.6 + 3.5 * (1 - Math.pow(1 - t, 3))));
    this.ring.material.opacity = 1 - t;
  }

  private points(pos: Float32Array, color: string, size: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size, map: this.dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    pts.frustumCulled = false;
    pts.visible = false;
    this.root.add(pts);
    return pts;
  }
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
