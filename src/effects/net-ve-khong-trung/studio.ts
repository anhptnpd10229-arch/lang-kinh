// Logic "vẽ trong không trung" dạng 2D, tách khỏi React để dễ thử nghiệm.
// Mọi nét nằm trên một mặt phẳng cố định trước camera; mọi biến đổi (kéo, xoay, phóng) chỉ trong mặt phẳng đó.
//
// Cử chỉ:
// - Giơ 3 ngón (giữ): bật bút; giơ 3 ngón lần nữa: tắt bút. Bút tắt thì chụm tay không vẽ.
// - Chụm ngón cái + trỏ (giữ một nhịp ngắn) khi bút bật: vẽ. Tay càng gần camera nét càng dày.
// - Hai tay cùng chụm: xoay và phóng to/thu nhỏ nét vừa vẽ.
// - ✌️ giữ: đổi kiểu bút (neon → bụi sao → cầu vồng).
// - 👍 giữ: các nét nhún nhảy vài giây.
// - 👎 giữ: hoàn tác nét cuối.
// - 🖐 giữ: xoá hết.
import type { Category, GestureRecognizerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { OneEuroFilter } from "@/core/one-euro";

/** Khoảng cách từ camera tới mặt phẳng vẽ (cm, cùng đơn vị với các effect khác). */
export const DEPTH = 50;

// Tỉ lệ khoảng cách 3D đầu ngón cái–trỏ so với kích thước bàn tay (cổ tay → gốc ngón giữa).
// Hai ngưỡng khác nhau để trạng thái chụm không nhấp nháy ở ranh giới.
const PINCH_ON = 0.25;
const PINCH_OFF = 0.4;
/** Phải chụm liên tục chừng này (ms) mới bắt đầu vẽ, để chụm thoáng qua không thành nét. */
const PINCH_ARM_MS = 180;
/** Nhả chụm ngắn hơn chừng này (ms) không cắt nét, tránh nét bị đứt vì tracker chập chờn. */
const RELEASE_GRACE_MS = 120;
/** Các cử chỉ mà ngón cái và trỏ có thể chạm nhau nhưng không phải là chụm để vẽ. */
const PINCH_VETO = new Set(["Closed_Fist", "Thumb_Up", "Thumb_Down", "Victory", "Open_Palm"]);
const MIN_STEP = 0.5;
const MAX_POINTS = 400;
const MIN_POINTS = 8;
const MIN_SIZE = 3;
const LOST_MS = 300;
const DIE_MS = 400;
const DANCE_MS = 3000;
const LINE_RADIUS = 0.35;
/** Kích thước bàn tay chuẩn (toạ độ chuẩn hoá) ứng với độ dày LINE_RADIUS. */
const REF_HAND_SIZE = 0.15;
const MIN_GESTURE_SCORE = 0.6;

/** Thời gian phải giữ cử chỉ (ms) trước khi kích hoạt. */
const HOLD_MS: Record<string, number> = { Three: 500, Open_Palm: 800, Victory: 500, Thumb_Up: 600, Thumb_Down: 600 };
/** Tên cử chỉ nội bộ cho "giơ 3 ngón" (bộ nhận diện của MediaPipe không có sẵn cử chỉ này). */
const THREE_FINGERS = "Three";
const PEN_OFF_COLOR = "#8a8780";

const PALETTE = ["#7cf7ff", "#c8ff3d", "#ff6b9d", "#b18cff", "#ffd36b"];

export const BRUSHES = ["neon", "sparkle", "rainbow"] as const;
export type Brush = (typeof BRUSHES)[number];

// 21 điểm bàn tay của MediaPipe; khai báo lại để effect không phải import cả thư viện.
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
const MAX_HANDS = 2;

export type StudioQuality = { radial: number; maxStrokes: number; halo: boolean };

type Stroke = { group: THREE.Group; dying: number; scale: number; rot: number; phase: number };

/** `pinched`: chụm đã giữ đủ lâu để vẽ; `arming`: 0→1 trong lúc đang chờ xác nhận chụm. */
type HandInfo = {
  size: number;
  pinched: boolean;
  arming: number;
  /** Số ngón đang duỗi (0–5); chỉ tính khi ngón cái và trỏ không chạm nhau. */
  fingers: number;
  tip: THREE.Vector3;
  gesture: Category | undefined;
};

type TwoHand = { stroke: Stroke; d0: number; a0: number; s0: number; r0: number };

export type StudioEvent =
  | { type: "stroke_start" | "stroke" | "discard" | "clear" | "undo" | "dance" | "transform" }
  | { type: "brush"; brush: Brush }
  | { type: "pen"; on: boolean };

export class AirStudio {
  readonly root = new THREE.Group();
  /** Số nét đang hiển thị (không tính nét đang tan). */
  get count() {
    return this.strokes.filter((s) => !s.dying).length;
  }
  get brush(): Brush {
    return BRUSHES[this.brushIndex];
  }
  /** Bút tắt khi bắt đầu; giơ 3 ngón để bật. */
  penOn = false;
  onEvent: ((e: StudioEvent) => void) | null = null;

  private strokes: Stroke[] = [];
  private points: THREE.Vector3[] = [];
  private live: THREE.Object3D[] = [];
  private color = new THREE.Color();
  private radius = LINE_RADIUS;
  private colorIndex = 0;
  private brushIndex = 0;
  private drawing = false;
  /** Sau khi thả hai tay, chờ mọi ngón mở ra mới cho vẽ tiếp, tránh vẽ nhầm. */
  private penLocked = false;
  private pinched = [false, false];
  private pinchSince = [0, 0];
  private releaseSince = 0;
  private filters = Array.from({ length: MAX_HANDS }, () => [new OneEuroFilter(1.5, 0.08), new OneEuroFilter(1.5, 0.08)]);
  private lastTs = -1;
  private lastSeen = 0;
  private holdName = "None";
  private holdSince = 0;
  private holdFired = false;
  private danceUntil = 0;
  private twoHand: TwoHand | null = null;
  private cursors: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[];
  private skeleton: THREE.LineSegments;
  private joints: THREE.Points;

  constructor(private quality: StudioQuality) {
    this.cursors = Array.from(
      { length: MAX_HANDS },
      () =>
        new THREE.Mesh(
          new THREE.CircleGeometry(0.6, 24),
          new THREE.MeshBasicMaterial({ color: PALETTE[0], transparent: true, blending: THREE.AdditiveBlending }),
        ),
    );
    const bones = new THREE.BufferGeometry();
    bones.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_HANDS * HAND_CONNECTIONS.length * 6), 3));
    this.skeleton = new THREE.LineSegments(
      bones,
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35 }),
    );
    const dots = new THREE.BufferGeometry();
    dots.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_HANDS * 21 * 3), 3));
    this.joints = new THREE.Points(
      dots,
      new THREE.PointsMaterial({ color: "#ffffff", size: 0.7, transparent: true, opacity: 0.6 }),
    );
    for (const o of [...this.cursors, this.skeleton, this.joints]) {
      o.visible = false;
      o.frustumCulled = false;
      this.root.add(o);
    }
  }

  setQuality(q: StudioQuality) {
    this.quality = q;
    this.trim(performance.now());
  }

  /**
   * Gọi mỗi khung hình render. `ts` là timestamp của kết quả tracker; chỉ xử lý khi có kết quả mới.
   * `w`, `h` là kích thước khung nhìn tại mặt phẳng vẽ (đơn vị thế giới).
   */
  update(hand: GestureRecognizerResult | undefined, ts: number, now: number, w: number, h: number) {
    if (hand && ts !== this.lastTs) {
      this.lastTs = ts;
      this.ingest(hand, ts, w, h);
    }
    if (now - this.lastSeen > LOST_MS) this.handsGone();
    this.animate(now);
  }

  clearAll(now: number) {
    this.strokes.forEach((s) => (s.dying ||= now));
    this.twoHand = null;
    this.emit({ type: "clear" });
  }

  dispose() {
    this.root.traverse(disposeObject);
  }

  private emit(e: StudioEvent) {
    this.onEvent?.(e);
  }

  private handsGone() {
    if (this.drawing) this.endStroke();
    for (const o of [...this.cursors, this.skeleton, this.joints]) o.visible = false;
    this.pinched = [false, false];
    this.pinchSince = [0, 0];
    this.releaseSince = 0;
    this.penLocked = false;
    this.twoHand = null;
    this.holdName = "None";
    // Không làm mượt từ vị trí cũ khi tay quay lại, tránh vệt nối dài.
    this.filters.forEach((f) => f.forEach((x) => x.reset()));
  }

  private ingest(result: GestureRecognizerResult, ts: number, w: number, h: number) {
    const hands = result.landmarks.slice(0, MAX_HANDS);
    if (!hands.length) return;
    this.lastSeen = ts;

    const toWorld = (p: { x: number; y: number }, out = new THREE.Vector3()) =>
      out.set((p.x - 0.5) * w, (0.5 - p.y) * h, -DEPTH);
    this.updateSkeleton(hands, toWorld);

    const t = ts / 1000;
    const info: HandInfo[] = hands.map((lm, i) => {
      const gesture = result.gestures[i]?.[0];
      const size = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-3;
      // Tính cả z: khi bàn tay nghiêng, hai đầu ngón có thể trùng nhau trên ảnh dù không chạm.
      const ratio = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y, lm[4].z - lm[8].z) / size;
      const vetoed = !!gesture && gesture.score > 0.5 && PINCH_VETO.has(gesture.categoryName);
      this.pinched[i] = !vetoed && (this.pinched[i] ? ratio < PINCH_OFF : ratio < PINCH_ON);
      if (!this.pinched[i]) this.pinchSince[i] = 0;
      else if (!this.pinchSince[i]) this.pinchSince[i] = ts;
      const held = this.pinched[i] ? ts - this.pinchSince[i] : 0;
      // Đang vẽ dở (trong thời gian ân hạn) thì chụm lại được nhận ngay, để nét nối tiếp không bị đứt.
      const pinched = this.pinched[i] && (held >= PINCH_ARM_MS || this.drawing);
      const arming = this.pinched[i] && !pinched ? held / PINCH_ARM_MS : 0;

      // Điểm giữa đầu ngón cái và ngón trỏ ổn định hơn từng đầu ngón khi đang chụm.
      const raw = toWorld({ x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 });
      const [fx, fy] = this.filters[i];
      const tip = new THREE.Vector3(fx.filter(raw.x, t), fy.filter(raw.y, t), -DEPTH);
      const fingers = this.pinched[i] ? 0 : countExtended(lm);
      return { size, pinched, arming, fingers, tip, gesture };
    });
    for (let i = hands.length; i < MAX_HANDS; i++) {
      this.pinched[i] = false;
      this.pinchSince[i] = 0;
      this.filters[i].forEach((x) => x.reset());
    }
    this.updateCursors(info);

    const pinching = info.filter((p) => p.pinched);
    if (pinching.length === 0) this.penLocked = false;

    // Hai tay cùng chụm: biến đổi nét, không vẽ.
    if (pinching.length === MAX_HANDS) {
      if (this.drawing) this.cancelStroke();
      this.transformTwoHand(pinching[0].tip, pinching[1].tip);
      this.holdName = "None";
      return;
    }
    if (this.twoHand) {
      this.twoHand = null;
      this.penLocked = true;
    }

    const pen = this.penLocked || !this.penOn ? undefined : pinching[0];
    if (pen) {
      this.releaseSince = 0;
      if (!this.drawing) this.startStroke(pen.size);
      this.addPoint(pen.tip);
    } else if (this.drawing) {
      if (!this.releaseSince) this.releaseSince = ts;
      if (ts - this.releaseSince >= RELEASE_GRACE_MS) this.endStroke();
    }

    // "Giơ 3 ngón" ưu tiên trước cử chỉ của MediaPipe (3 ngón trỏ–giữa–áp út hay bị nhận nhầm là chữ V).
    const three = info.find((p) => p.fingers === 3);
    const actor = three ?? info.find((p) => !p.pinched && !p.arming && p.gesture && p.gesture.score > MIN_GESTURE_SCORE);
    const name = three ? THREE_FINGERS : (actor?.gesture?.categoryName ?? "None");
    this.hold(name, ts);
  }

  /** Kích hoạt cử chỉ một lần sau khi giữ đủ lâu; phải đổi cử chỉ mới kích hoạt lại. */
  private hold(name: string, ts: number) {
    if (name !== this.holdName) {
      this.holdName = name;
      this.holdSince = ts;
      this.holdFired = false;
      return;
    }
    const need = HOLD_MS[name];
    if (!need || this.holdFired || ts - this.holdSince < need) return;
    this.holdFired = true;
    switch (name) {
      case THREE_FINGERS:
        this.penOn = !this.penOn;
        if (!this.penOn && this.drawing) this.endStroke();
        return this.emit({ type: "pen", on: this.penOn });
      case "Open_Palm":
        return this.clearAll(ts);
      case "Victory":
        this.brushIndex = (this.brushIndex + 1) % BRUSHES.length;
        return this.emit({ type: "brush", brush: this.brush });
      case "Thumb_Up":
        this.danceUntil = ts + DANCE_MS;
        return this.emit({ type: "dance" });
      case "Thumb_Down":
        return this.undo(ts);
    }
  }

  private undo(now: number) {
    const last = [...this.strokes].reverse().find((s) => !s.dying);
    if (!last) return;
    last.dying = now;
    this.emit({ type: "undo" });
  }

  private transformTwoHand(a: THREE.Vector3, b: THREE.Vector3) {
    const d = Math.max(a.distanceTo(b), 1e-3);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (!this.twoHand) {
      const target = [...this.strokes].reverse().find((s) => !s.dying);
      if (!target) return;
      this.twoHand = { stroke: target, d0: d, a0: angle, s0: target.scale, r0: target.rot };
      this.emit({ type: "transform" });
      return;
    }
    const { stroke, d0, a0, s0, r0 } = this.twoHand;
    stroke.scale = THREE.MathUtils.clamp((s0 * d) / d0, 0.3, 4);
    stroke.rot = r0 + angle - a0;
  }

  private updateCursors(info: HandInfo[]) {
    this.cursors.forEach((c, i) => {
      const hand = info[i];
      c.visible = !!hand;
      if (!hand) return;
      c.position.copy(hand.tip);
      // Bút tắt: chấm xám mờ. Bút bật: trong lúc chờ xác nhận chụm, chấm to dần và sáng dần để báo "sắp vẽ".
      const k = !this.penOn ? 0 : hand.pinched ? 1 : hand.arming;
      c.scale.setScalar((this.radiusFor(hand.size) / LINE_RADIUS) * (1 + 0.4 * k));
      c.material.color.set(
        this.penOn ? new THREE.Color(this.previewColor()).lerp(new THREE.Color("#ffffff"), k) : PEN_OFF_COLOR,
      );
      c.material.opacity = this.penOn ? 0.6 + 0.4 * k : 0.35;
    });
  }

  private previewColor() {
    if (this.brush === "rainbow") return new THREE.Color().setHSL((performance.now() / 2000) % 1, 1, 0.6);
    return PALETTE[this.colorIndex % PALETTE.length];
  }

  private radiusFor(handSize: number) {
    return THREE.MathUtils.clamp((LINE_RADIUS * handSize) / REF_HAND_SIZE, 0.18, 1);
  }

  private updateSkeleton(hands: NormalizedLandmark[][], toWorld: (p: NormalizedLandmark, out?: THREE.Vector3) => THREE.Vector3) {
    const v = new THREE.Vector3();
    const bones = this.skeleton.geometry.getAttribute("position") as THREE.BufferAttribute;
    const dots = this.joints.geometry.getAttribute("position") as THREE.BufferAttribute;
    hands.forEach((lm, h) => {
      const boneBase = h * HAND_CONNECTIONS.length * 2;
      HAND_CONNECTIONS.forEach(([a, b], i) => {
        toWorld(lm[a], v);
        bones.setXYZ(boneBase + i * 2, v.x, v.y, v.z);
        toWorld(lm[b], v);
        bones.setXYZ(boneBase + i * 2 + 1, v.x, v.y, v.z);
      });
      lm.forEach((p, i) => {
        toWorld(p, v);
        dots.setXYZ(h * 21 + i, v.x, v.y, v.z);
      });
    });
    bones.needsUpdate = dots.needsUpdate = true;
    this.skeleton.geometry.setDrawRange(0, hands.length * HAND_CONNECTIONS.length * 2);
    this.joints.geometry.setDrawRange(0, hands.length * 21);
    this.skeleton.visible = this.joints.visible = true;
  }

  private startStroke(handSize: number) {
    this.drawing = true;
    this.releaseSince = 0;
    this.points = [];
    this.radius = this.radiusFor(handSize);
    this.color.set(PALETTE[this.colorIndex % PALETTE.length]);
    this.emit({ type: "stroke_start" });
  }

  private addPoint(p: THREE.Vector3) {
    const last = this.points[this.points.length - 1];
    if (last && last.distanceTo(p) < MIN_STEP) return;
    this.points.push(p.clone());
    if (this.points.length >= MAX_POINTS) return this.endStroke();
    this.rebuildLive();
  }

  private rebuildLive() {
    this.clearLive();
    if (this.points.length < 2) return;
    this.live = this.brushMeshes(this.points, false);
    this.live.forEach((m) => this.root.add(m));
  }

  private clearLive() {
    for (const m of this.live) {
      this.root.remove(m);
      disposeObject(m);
    }
    this.live = [];
  }

  private cancelStroke() {
    this.drawing = false;
    this.points = [];
    this.clearLive();
  }

  private endStroke() {
    this.drawing = false;
    const pts = this.points;
    this.points = [];
    this.clearLive();

    const box = new THREE.Box3().setFromPoints(pts);
    const diag = box.getSize(new THREE.Vector3()).length();
    if (pts.length < MIN_POINTS || diag < MIN_SIZE) {
      this.emit({ type: "discard" });
      return;
    }

    // Đặt nét trong một group ở tâm của nó để mọi phép xoay/phóng/tan đều quanh tâm nét.
    const center = box.getCenter(new THREE.Vector3());
    const closed = pts[0].distanceTo(pts[pts.length - 1]) < Math.max(4, diag * 0.25);
    const group = new THREE.Group();
    group.position.copy(center);
    group.add(...this.brushMeshes(pts.map((p) => p.clone().sub(center)), closed));
    this.root.add(group);
    this.strokes.push({ group, dying: 0, scale: 1, rot: 0, phase: Math.random() * Math.PI * 2 });
    this.colorIndex++;
    this.trim(performance.now());
    this.emit({ type: "stroke" });
  }

  private brushMeshes(points: THREE.Vector3[], closed: boolean): THREE.Object3D[] {
    const curve = new THREE.CatmullRomCurve3(points, closed);
    switch (this.brush) {
      case "sparkle":
        return [this.sparkleMesh(curve)];
      case "rainbow":
        return this.tubeMeshes(curve, points.length, closed, true);
      default:
        return this.tubeMeshes(curve, points.length, closed, false);
    }
  }

  /** Nét sáng: lõi gần trắng + quầng cộng sáng phía ngoài; cầu vồng thì đổi màu dọc chiều dài nét. */
  private tubeMeshes(curve: THREE.Curve<THREE.Vector3>, n: number, closed: boolean, rainbow: boolean) {
    const { radial, halo } = this.quality;
    const segments = Math.min(n * 3, 600);
    const make = (radius: number, lightness: number, material: THREE.MeshBasicMaterial) => {
      const geo = new THREE.TubeGeometry(curve, segments, radius, radial, closed);
      if (rainbow) {
        const colors = new Float32Array(geo.attributes.position.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i <= segments; i++) {
          c.setHSL((i / segments) * 0.85, 1, lightness);
          for (let j = 0; j <= radial; j++) c.toArray(colors, (i * (radial + 1) + j) * 3);
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        material.vertexColors = true;
        material.color.set("#ffffff");
      }
      return new THREE.Mesh(geo, material);
    };

    const core = make(
      this.radius,
      0.72,
      new THREE.MeshBasicMaterial({ color: this.color.clone().lerp(new THREE.Color("#ffffff"), 0.5) }),
    );
    if (!halo) return [core];
    const glow = make(
      this.radius * 3,
      0.55,
      new THREE.MeshBasicMaterial({
        color: this.color.clone(),
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    return [core, glow];
  }

  /** Bụi sao: các chấm sáng kích thước ngẫu nhiên rải đều dọc nét. */
  private sparkleMesh(curve: THREE.Curve<THREE.Vector3>) {
    const count = Math.max(2, Math.min(800, Math.round(curve.getLength() / (this.radius * 2.2))));
    const mesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 12),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      count,
    );
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    curve.getSpacedPoints(count - 1).forEach((p, i) => {
      o.position.copy(p);
      o.scale.setScalar(this.radius * (0.8 + Math.random() * 1.6));
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.copy(this.color).lerp(new THREE.Color("#ffffff"), Math.random() * 0.6));
    });
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Giữ số nét trong giới hạn của mức chất lượng; nét cũ nhất tan đi trước. */
  private trim(now: number) {
    const alive = this.strokes.filter((s) => !s.dying);
    alive.slice(0, Math.max(0, alive.length - this.quality.maxStrokes)).forEach((s) => (s.dying = now));
  }

  private animate(now: number) {
    // Biên độ nhảy tăng dần lúc đầu và giảm dần lúc cuối.
    const left = (this.danceUntil - now) / DANCE_MS;
    const dance = left > 0 ? Math.min(1, (1 - left) * 5, left * 5) : 0;

    this.strokes = this.strokes.filter((s) => {
      const life = s.dying ? 1 - (now - s.dying) / DIE_MS : 1;
      if (life <= 0) {
        this.root.remove(s.group);
        s.group.traverse(disposeObject);
        return false;
      }
      const wob = dance * Math.sin((now / 1000) * 8 + s.phase);
      s.group.scale.setScalar(s.scale * (1 + 0.12 * wob) * life);
      s.group.rotation.z = s.rot + 0.18 * wob;
      return true;
    });
  }
}

/**
 * Đếm số ngón đang duỗi. Ngón thường: đầu ngón xa cổ tay hơn khớp giữa (PIP).
 * Ngón cái: đầu ngón xa gốc ngón út hơn khớp IP (khi gập ngang lòng bàn tay thì đầu ngón lại gần gốc ngón út).
 */
export function countExtended(lm: NormalizedLandmark[]): number {
  const d = (a: number, b: number) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y, lm[a].z - lm[b].z);
  let n = d(4, 17) > d(3, 17) * 1.05 ? 1 : 0;
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) if (d(0, tip) > d(0, pip) * 1.1) n++;
  return n;
}

function disposeObject(o: THREE.Object3D) {
  if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) {
    o.geometry.dispose();
    (o.material as THREE.Material).dispose();
  }
}
