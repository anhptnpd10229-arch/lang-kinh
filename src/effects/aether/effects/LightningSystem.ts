// Tia sét phân nhánh sinh bằng thuật toán dời điểm giữa (midpoint displacement).
// Mọi tia ghi vào MỘT bộ đệm LineSegments cấp phát sẵn; mỗi khung hình chỉ ghi đè dữ liệu, không tạo tài nguyên GPU mới.
// Mỗi tia sống rất ngắn và chập chờn; hệ thống liên tục sinh tia mới với tần suất do bên ngoài điều khiển.
import * as THREE from "three";
import { MAX_LIGHTNING_SEGMENTS } from "./uniforms";

const LEVELS = 4; // 2^4 = 16 đoạn cho thân tia
const MAX_POINTS = (1 << LEVELS) + 1;
const MAX_BOLTS = 64;
/** Màu tia (tuyến tính, > 1 để bloom bắt được). */
const CORE_COLOR = new THREE.Color(2.6, 3.4, 4.2);

type Bolt = {
  /** Các đoạn thẳng (cặp điểm) của tia, kể cả nhánh. */
  segs: Float32Array;
  count: number;
  born: number;
  life: number;
  power: number;
  seed: number;
};

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpPerp = new THREE.Vector3();

export class LightningSystem {
  readonly lines: THREE.LineSegments;
  private positions: Float32Array;
  private colors: Float32Array;
  private bolts: Bolt[] = [];
  private pool: Bolt[] = [];
  private points = Array.from({ length: MAX_POINTS }, () => new THREE.Vector3());
  private maxSegments = MAX_LIGHTNING_SEGMENTS;

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_LIGHTNING_SEGMENTS * 6);
    this.colors = new Float32Array(MAX_LIGHTNING_SEGMENTS * 6);
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    this.lines.frustumCulled = false;
    for (let i = 0; i < MAX_BOLTS; i++) this.pool.push({ segs: new Float32Array(160 * 6), count: 0, born: 0, life: 0, power: 0, seed: 0 });
  }

  setMaxSegments(n: number) {
    this.maxSegments = Math.min(n, MAX_LIGHTNING_SEGMENTS);
  }

  clear() {
    this.pool.push(...this.bolts);
    this.bolts = [];
  }

  /**
   * Sinh một tia từ `from` tới `to` (toạ độ cục bộ của quả cầu).
   * `jitter`: độ lệch ngang so với chiều dài; `branches`: số nhánh phụ.
   */
  spawn(from: THREE.Vector3, to: THREE.Vector3, now: number, opts: { jitter?: number; branches?: number; life?: number; power?: number } = {}) {
    const bolt = this.pool.pop() ?? this.bolts.shift();
    if (!bolt) return;
    bolt.count = 0;
    bolt.born = now;
    bolt.life = opts.life ?? 70 + Math.random() * 110;
    bolt.power = opts.power ?? 1;
    bolt.seed = Math.random() * 100;
    const n = this.path(from, to, opts.jitter ?? 0.28, LEVELS);
    this.writePath(bolt, n);
    // Nhánh: tách ra từ một điểm giữa thân, chĩa lệch đi và ngắn hơn.
    const branches = opts.branches ?? 2;
    const trunk = this.points.slice(0, n).map((p) => p.clone());
    for (let b = 0; b < branches; b++) {
      const i = 3 + Math.floor(Math.random() * (n - 6));
      tmpA.copy(trunk[i]);
      tmpDir.subVectors(trunk[Math.min(n - 1, i + 3)], tmpA);
      const len = tmpDir.length() * (1.2 + Math.random() * 1.5);
      tmpDir.normalize().add(randomUnit(tmpPerp).multiplyScalar(0.9)).normalize();
      tmpB.copy(tmpA).addScaledVector(tmpDir, len);
      this.writePath(bolt, this.path(tmpA, tmpB, 0.35, LEVELS - 1));
    }
    this.bolts.push(bolt);
  }

  /** Ghi tất cả tia đang sống vào bộ đệm, kèm độ sáng chập chờn và mờ dần theo tuổi. */
  update(now: number, brightness: number) {
    let seg = 0;
    this.bolts = this.bolts.filter((b) => {
      const age = (now - b.born) / b.life;
      if (age >= 1) {
        this.pool.push(b);
        return false;
      }
      // Chập chờn: tắt/sáng nhanh, mạnh nhất lúc mới sinh.
      const flicker = 0.55 + 0.45 * Math.sin(now * 0.09 + b.seed * 7) * Math.sin(now * 0.053 + b.seed);
      const k = (1 - age) * (1 - age) * flicker * b.power * brightness;
      for (let i = 0; i < b.count && seg < this.maxSegments; i++, seg++) {
        this.positions.set(b.segs.subarray(i * 6, i * 6 + 6), seg * 6);
        // Đầu tia (gần lõi) sáng hơn đuôi.
        const tail = 1 - (i / Math.max(1, b.count)) * 0.5;
        for (let v = 0; v < 2; v++) {
          const o = seg * 6 + v * 3;
          this.colors[o] = CORE_COLOR.r * k * tail;
          this.colors[o + 1] = CORE_COLOR.g * k * tail;
          this.colors[o + 2] = CORE_COLOR.b * k * tail;
        }
      }
      return true;
    });
    const geo = this.lines.geometry;
    geo.setDrawRange(0, seg * 2);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }

  /** Dời điểm giữa: trả về số điểm đã ghi vào this.points. */
  private path(a: THREE.Vector3, b: THREE.Vector3, jitter: number, levels: number) {
    const n = (1 << levels) + 1;
    const pts = this.points;
    pts[0].copy(a);
    pts[n - 1].copy(b);
    const len = a.distanceTo(b);
    for (let step = n - 1, amp = jitter * len; step > 1; step >>= 1, amp *= 0.55) {
      for (let i = 0; i + step < n; i += step) {
        const m = i + step / 2;
        pts[m].addVectors(pts[i], pts[i + step]).multiplyScalar(0.5);
        tmpDir.subVectors(pts[i + step], pts[i]).normalize();
        randomUnit(tmpPerp).addScaledVector(tmpDir, -tmpPerp.dot(tmpDir)).normalize();
        pts[m].addScaledVector(tmpPerp, (Math.random() - 0.5) * 2 * amp);
      }
    }
    return n;
  }

  private writePath(bolt: Bolt, n: number) {
    const cap = bolt.segs.length / 6;
    for (let i = 0; i < n - 1 && bolt.count < cap; i++, bolt.count++) {
      const o = bolt.count * 6;
      const p = this.points[i];
      const q = this.points[i + 1];
      bolt.segs[o] = p.x;
      bolt.segs[o + 1] = p.y;
      bolt.segs[o + 2] = p.z;
      bolt.segs[o + 3] = q.x;
      bolt.segs[o + 4] = q.y;
      bolt.segs[o + 5] = q.z;
    }
  }
}

export function randomUnit(out: THREE.Vector3) {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(t), s * Math.sin(t), u);
}
