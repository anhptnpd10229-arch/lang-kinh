// Hạt hào quang quanh quả cầu (toạ độ cục bộ, bán kính quả cầu = 1).
// - Lúc triệu hồi: bắt đầu rải rác quanh lòng bàn tay rồi hội tụ về quỹ đạo.
// - Lúc hoạt động: bay quỹ đạo, trôi lơ lửng.
// - Lúc nạp: bị hút sát vào lõi và quay nhanh dần.
import * as THREE from "three";
import { particleMaterial } from "./particleMaterial";
import { MAX_PARTICLES } from "./uniforms";

export class AuraParticles {
  readonly points: THREE.Points;
  readonly fade = { value: 0 };
  private pos: Float32Array;
  private start: Float32Array;
  private radius = new Float32Array(MAX_PARTICLES);
  private theta = new Float32Array(MAX_PARTICLES);
  private incl = new Float32Array(MAX_PARTICLES);
  private speed = new Float32Array(MAX_PARTICLES);
  private delay = new Float32Array(MAX_PARTICLES);
  private count = MAX_PARTICLES;

  constructor(scale: { value: number }) {
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.start = new Float32Array(MAX_PARTICLES * 3);
    const size = new Float32Array(MAX_PARTICLES);
    const bright = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.radius[i] = 1.15 + Math.pow(Math.random(), 1.6) * 1.6;
      this.theta[i] = Math.random() * Math.PI * 2;
      this.incl[i] = (Math.random() - 0.5) * Math.PI;
      this.speed[i] = (0.4 + Math.random() * 1.1) * (Math.random() < 0.5 ? -1 : 1);
      this.delay[i] = Math.random() * 0.45;
      size[i] = 0.025 + Math.pow(Math.random(), 3) * 0.1;
      bright[i] = 0.35 + Math.random() * 0.9;
    }
    this.scatter();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
    this.points = new THREE.Points(geo, particleMaterial(this.fade, scale));
    this.points.frustumCulled = false;
  }

  setCount(n: number) {
    this.count = Math.min(n, MAX_PARTICLES);
    this.points.geometry.setDrawRange(0, this.count);
  }

  /** Rải điểm xuất phát mới (quanh lòng bàn tay, phía dưới quả cầu) cho lần triệu hồi tiếp theo. */
  scatter() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 3;
      this.start[i * 3] = Math.cos(a) * r;
      this.start[i * 3 + 1] = -1.2 + Math.sin(a) * r * 0.6;
      this.start[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
  }

  /**
   * `summon`: tiến độ hội tụ 0→1; `charge`: mức nạp 0→1; `spin`: hệ số tốc độ quay.
   */
  update(time: number, dt: number, summon: number, charge: number, spin: number) {
    const shrink = 1 - 0.5 * charge;
    for (let i = 0; i < this.count; i++) {
      this.theta[i] += this.speed[i] * spin * (1 + charge * 3) * dt;
      const r = this.radius[i] * shrink * (1 + 0.05 * Math.sin(time * 2 + i));
      const t = this.theta[i];
      const inc = this.incl[i] + Math.sin(time * 0.6 + i * 0.37) * 0.15;
      let x = Math.cos(t) * Math.cos(inc) * r;
      let y = Math.sin(inc) * r;
      let z = Math.sin(t) * Math.cos(inc) * r;
      if (summon < 1) {
        // Mỗi hạt hội tụ lệch pha một chút để trông như dòng chảy chứ không đồng loạt.
        const k = Math.min(1, Math.max(0, (summon - this.delay[i]) / (1 - this.delay[i])));
        const e = k * k * (3 - 2 * k);
        x = this.start[i * 3] + (x - this.start[i * 3]) * e;
        y = this.start[i * 3 + 1] + (y - this.start[i * 3 + 1]) * e;
        z = this.start[i * 3 + 2] + (z - this.start[i * 3 + 2]) * e;
      }
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
