// Cảnh "Tiệm Giặt" dựng bằng three.js thuần, phong cách minh hoạ phẳng (MeshBasic, không đèn).
// Video camera hiện trong ô cửa lồng giặt; giặt xong, phần đầu + vai được cắt rời và phơi lên dây.
//
// Mọi kích thước dưới đây tính theo "đơn vị thiết kế": khung cảnh cao ~100 đơn vị, gốc ở giữa.
// `root` được co giãn để khung đó vừa phần khung hình người dùng thực sự nhìn thấy.
import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import type { SegmentationMask } from "@/core/tracker-hub";
import { captureCutout, CUT_H, CUT_W, type Cutout } from "./capture";
import { UNLOAD, WashCycle, type Phase } from "./cycle";

export const DEPTH = 50;

const COLOR = {
  wall: "#f3eee6",
  wainscot: "#e4eef1",
  trim: "#cfdde2",
  floorA: "#ece5d9",
  floorB: "#e0d7c8",
  body: "#fbfaf7",
  bodyShade: "#e2e6e7",
  panel: "#dce7eb",
  display: "#1f3a4a",
  displayText: "#8ff0e0",
  start: "#7fd1b9",
  stop: "#f29e8e",
  ring: "#cdd5d9",
  ringDark: "#8e9ba2",
  side: "#c6dbe2",
  sideDark: "#2c4553",
  line: "#b8996c",
  peg: "#d9a066",
  foam: "#ffffff",
};
const CLOTH_COLORS = ["#f6d6c9", "#cfe8dc", "#fbe7b5", "#d9d4f2", "#f7c6cf", "#c8e2f2", "#fff6e8", "#e6d3bd", "#bfe0d0"];

const MACHINE = { w: 46, h: 58, y: -14 };
const PANEL_Y = MACHINE.y + MACHINE.h / 2 - 6.5;
const DOOR = { y: -20, R: 15, ring: 18.5 };
const LINE_Y = 44;
const SAG = 3;
const FLOOR_Y = -43;
const CUT_SIZE = { w: 18, h: (18 * CUT_H) / CUT_W };
/** Khoảng cách tối thiểu giữa hai ảnh phơi trên dây. */
const SLOT_GAP = 21;
const FLY_MS = 1400;
const FALL_MS = 900;
/** Chỗ cầm ảnh lên giũ, ngay trên nóc máy giặt. */
const SHAKE_SPOT = new THREE.Vector3(0, 36, 1.5);
const MAX_DROPS = 36;
const DROP_LIFE_MS = 700;
const JAW_OPEN = 0.5;
const JAW_HOLD_MS = 400;

export type LaundryQuality = { clothes: number; bubbles: number };
const MAX_CLOTHES = 9;
const MAX_BUBBLES = 28;

type Cloth = { mesh: THREE.Mesh; pile: THREE.Vector2; pileRot: number; orbit: number; phase: number; selfSpin: number };
type Bubble = { mesh: THREE.Mesh; x: number; y: number; speed: number };
type Drop = { mesh: THREE.Mesh; vel: THREE.Vector2; born: number };
type Hung = {
  pivot: THREE.Group;
  card: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  /** Lúc lấy ra khỏi lồng (bắt đầu giũ). */
  born: number;
  /** Lúc bắt đầu bay lên dây; 0 khi còn đang giũ. */
  flyAt: number;
  /** Vị trí lúc bắt đầu bay (lấy ở khung hình bay đầu tiên). */
  from: THREE.Vector3;
  /** Số lần đã giũ (để mỗi lần chỉ văng nước một lần). */
  snaps: number;
  sway: number;
  falling: number;
  fallFrom: THREE.Vector3;
};

type Action = "start" | "stop";

const flat = (color: THREE.ColorRepresentation, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 6);
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Nhãn chữ vẽ bằng canvas (không cần tải font). */
class Label {
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private text = "";

  constructor(
    private w: number,
    private h: number,
    private style: { color: string; bg?: string; font: string },
  ) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    this.ctx = c.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  set(text: string) {
    if (text === this.text) return;
    this.text = text;
    const g = this.ctx;
    g.clearRect(0, 0, this.w, this.h);
    if (this.style.bg) {
      g.fillStyle = this.style.bg;
      g.fillRect(0, 0, this.w, this.h);
    }
    g.fillStyle = this.style.color;
    g.font = this.style.font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, this.w / 2, this.h / 2 + 2);
    this.texture.needsUpdate = true;
  }
}

const DRUM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Ô cửa lồng giặt: video (lật gương, bám theo khuôn mặt) xoay theo lồng, lỗ lồng giặt, nước, bọt, phản quang kính.
const DRUM_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 center;   // tâm khung nhìn trong không gian hiển thị (đã lật gương, y hướng lên)
  uniform float span;    // phần chiều cao video lọt vừa đường kính ô cửa
  uniform float aspect;  // rộng/cao của video
  uniform float angle;
  uniform float water;
  uniform float time;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float c = cos(angle), s = sin(angle);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);

    vec2 d = vec2(center.x + q.x * span / aspect, center.y + q.y * span);
    vec3 col = vec3(0.13, 0.17, 0.19);
    if (d.x >= 0.0 && d.x <= 1.0 && d.y >= 0.0 && d.y <= 1.0) {
      col = texture2D(map, vec2(1.0 - d.x, d.y)).rgb;
    }

    // Lỗ lồng giặt quay theo lồng, rõ hơn ở sát mép.
    vec2 cell = fract(q * 26.0) - 0.5;
    float holes = smoothstep(0.2, 0.12, length(cell));
    col = mix(col, col * 0.5, holes * mix(0.12, 0.45, smoothstep(0.28, 0.46, r)));

    // Nước + lớp bọt ở mặt nước.
    float surface = -0.5 + water + 0.012 * sin(p.x * 28.0 + time * 5.0) + 0.008 * sin(p.x * 61.0 - time * 7.0);
    if (water > 0.001 && p.y < surface) {
      col = mix(col, vec3(0.62, 0.86, 0.95), 0.38);
    }
    float foamBand = smoothstep(0.05, 0.0, abs(p.y - surface)) * step(0.001, water);
    vec2 fc = fract(vec2(p.x * 34.0 + time * 0.6, p.y * 34.0)) - 0.5;
    float foam = foamBand * smoothstep(0.42, 0.3, length(fc));
    col = mix(col, vec3(1.0), foam * 0.85);

    // Viền tối và vệt phản quang của kính.
    col *= mix(1.0, 0.55, smoothstep(0.32, 0.5, r));
    float arc = smoothstep(0.012, 0.0, abs(r - 0.4)) * smoothstep(0.0, -0.2, p.x + p.y);
    col += arc * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Ảnh phơi như một tấm vải: nếp nhăn (wrinkle) làm vải co lại và gồ ghề, có đổ bóng;
// khi giũ, một làn sóng chạy từ chỗ kẹp xuống mép dưới.
const CARD_VERTEX = /* glsl */ `
  uniform float wrinkle;
  uniform float wave;
  uniform float phase;
  uniform float height;
  varying vec2 vUv;
  varying float vShade;

  float folds(vec2 p) {
    return sin(p.x * 0.9 + sin(p.y * 0.7) * 2.0) * cos(p.y * 1.1 + p.x * 0.3) + 0.5 * sin(p.x * 2.3 - p.y * 1.7);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    // 0 ở chỗ kẹp, 1 ở mép xa nhất.
    float d = clamp(-pos.y / height, 0.0, 1.0);
    float f = folds(pos.xy);
    float w = sin(d * 7.0 - phase);
    pos.z += wrinkle * 1.8 * f + wave * w * d * 2.8;
    // Vải nhăn thì co lại về phía giữa, nhưng giữ nguyên mép kẹp.
    vec2 mid = vec2(0.0, -height * 0.5);
    pos.xy = mix(pos.xy, mid + (pos.xy - mid) * 0.7, wrinkle * 0.6 * d);
    float slope = folds(position.xy + vec2(0.35, 0.2)) - f;
    vShade = clamp(slope * wrinkle * 1.4 + cos(d * 7.0 - phase) * wave * d * 0.5, -0.6, 0.6);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CARD_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.02) discard;
    vec3 col = c.rgb * (1.0 - max(vShade, 0.0) * 0.7) + max(-vShade, 0.0) * 0.25;
    gl_FragColor = vec4(col, c.a * opacity);
  }
`;

export class LaundryScene {
  readonly root = new THREE.Group();
  readonly cycle = new WashCycle();
  onMessage: ((message: string) => void) | null = null;

  private machine = new THREE.Group();
  private drum: THREE.ShaderMaterial;
  private videoTex: THREE.VideoTexture;
  private display = new Label(320, 96, { color: COLOR.displayText, bg: COLOR.display, font: "700 46px ui-monospace, Menlo, Consolas, monospace" });
  private buttons: Record<Action, THREE.Mesh>;
  private pressedAt = new Map<THREE.Object3D, number>();
  private tumble = new THREE.Group();
  private clothes: Cloth[] = [];
  private bubbles: Bubble[] = [];
  private line: THREE.Mesh | null = null;
  private half = 0;
  private hung: Hung[] = [];
  private pending: Cutout | null = null;
  private spin = 0;
  private agitation = 0;
  private center = new THREE.Vector2(0.5, 0.5);
  private span = 0.9;
  private jawSince = 0;
  private hungCount = 0;
  private drops: Drop[] = [];

  constructor(
    private video: HTMLVideoElement,
    private quality: LaundryQuality,
  ) {
    // Shader của ô cửa làm việc thẳng trên giá trị màu hiển thị (sRGB): không giải mã khi đọc video,
    // không mã hoá lại khi ghi ra. Đặt SRGBColorSpace ở đây làm video sáng gấp đôi vì bị mã hoá hai lần.
    this.videoTex = new THREE.VideoTexture(video);
    this.videoTex.colorSpace = THREE.NoColorSpace;
    this.drum = new THREE.ShaderMaterial({
      vertexShader: DRUM_VERTEX,
      fragmentShader: DRUM_FRAGMENT,
      uniforms: {
        map: { value: this.videoTex },
        center: { value: this.center },
        span: { value: this.span },
        aspect: { value: 4 / 3 },
        angle: { value: 0 },
        water: { value: 0 },
        time: { value: 0 },
      },
      toneMapped: false,
    });

    this.buildRoom();
    this.buttons = this.buildMachine();
    this.buildTumble();
    this.root.add(this.machine);
    this.buildDrops();
    this.display.set("SẴN SÀNG");
  }

  setQuality(q: LaundryQuality) {
    this.quality = q;
    this.clothes.forEach((c, i) => (c.mesh.visible = i < q.clothes));
  }

  /** Gọi khi người dùng chạm vào một vật trong cảnh. */
  press(object: THREE.Object3D, now: number, face: FaceLandmarkerResult | undefined, mask: SegmentationMask | undefined) {
    let o: THREE.Object3D | null = object;
    while (o && !o.userData.action) o = o.parent;
    if (!o) return;
    this.pressedAt.set(o, now);
    if (o.userData.action === "start") this.tryStart(now, face, mask);
    else this.stop(now);
  }

  isButton(object: THREE.Object3D) {
    for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o.userData.action) return true;
    return false;
  }

  /**
   * Gọi mỗi khung hình. `vw`, `vh`: kích thước phần khung hình người dùng nhìn thấy, tính ở mặt phẳng cảnh.
   */
  update(now: number, dt: number, face: FaceLandmarkerResult | undefined, mask: SegmentationMask | undefined, vw: number, vh: number) {
    const unit = Math.min(vh / 100, vw / 60);
    this.root.scale.setScalar(unit);
    this.root.position.set(0, 2 * unit, -DEPTH);
    const half = vw / unit / 2;
    if (Math.abs(half - this.half) > 0.5) this.buildLine(half);

    this.trackFace(face, dt);
    this.watchJaw(now, face, mask);

    let next: Phase | null;
    while ((next = this.cycle.update(now))) this.enterPhase(next, now);

    const rate = this.cycle.spinRate(now);
    this.spin += rate * Math.PI * 2 * dt;
    this.agitation += (Math.min(1, Math.abs(rate) / 1.1) * (this.cycle.running ? 1 : 0) - this.agitation) * Math.min(1, dt * 3);
    const water = this.cycle.water(now);

    const u = this.drum.uniforms;
    u.angle.value = this.spin;
    u.water.value = water;
    u.time.value = now / 1000;
    u.span.value = this.span;
    u.aspect.value = this.video.videoWidth / (this.video.videoHeight || 1) || 4 / 3;

    this.animateClothes(now, water);
    this.animateBubbles(dt, water);
    this.machine.position.x = Math.sin(now / 1000 * 55) * 0.35 * this.cycle.shake(now);
    this.display.set(this.displayText(now));
    this.animateButtons(now);
    this.animateHung(now, dt);
    this.animateDrops(now, dt);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) disposeMesh(o);
    });
    this.videoTex.dispose();
    this.display.texture.dispose();
  }

  // ---------- Điều khiển ----------

  private tryStart(now: number, face: FaceLandmarkerResult | undefined, mask: SegmentationMask | undefined) {
    if (this.cycle.phase !== "idle") return;
    const lm = face?.faceLandmarks?.[0];
    if (!lm) {
      this.onMessage?.("Đưa mặt vào lồng giặt trước đã");
      return;
    }
    // Chụp ngay lúc bắt đầu, khi mặt còn thẳng; giặt xong mới đem phơi.
    this.pending = captureCutout(this.video, lm, mask);
    this.cycle.start(now);
    this.onMessage?.("Bắt đầu giặt!");
  }

  private stop(now: number) {
    if (this.cycle.cancel(now)) {
      this.pending = null;
      this.onMessage?.("Đã dừng máy");
      return;
    }
    if (this.cycle.phase === "idle" && this.hung.some((h) => !h.falling)) {
      this.hung.forEach((h) => this.drop(h, now));
      this.onMessage?.("Đã gỡ hết đồ phơi");
    }
  }

  private watchJaw(now: number, face: FaceLandmarkerResult | undefined, mask: SegmentationMask | undefined) {
    const jaw = face?.faceBlendshapes?.[0]?.categories.find((c) => c.categoryName === "jawOpen")?.score ?? 0;
    if (this.cycle.phase !== "idle" || jaw < JAW_OPEN) {
      this.jawSince = 0;
      return;
    }
    if (!this.jawSince) this.jawSince = now;
    else if (now - this.jawSince >= JAW_HOLD_MS) {
      this.jawSince = 0;
      this.tryStart(now, face, mask);
    }
  }

  private enterPhase(phase: Phase, now: number) {
    // Mốc thời gian lấy theo lúc pha thực sự bắt đầu (khung hình có thể đến trễ).
    const at = Math.min(now, this.cycle.phaseStart);
    if (phase === "wash") this.onMessage?.("Nước đủ rồi, bắt đầu quay…");
    if (phase === "spin") this.onMessage?.("Vắt khô…");
    if (phase === "unload" && this.pending) {
      this.takeOut(this.pending, at);
      this.pending = null;
      this.onMessage?.("Lấy đồ ra, giũ cho phẳng…");
    }
    if (phase === "hang") {
      const item = this.hung.find((h) => !h.flyAt && !h.falling);
      if (item) {
        item.flyAt = at;
        this.onMessage?.("Phơi lên dây!");
      }
    }
  }

  private displayText(now: number) {
    const s = Math.ceil(this.cycle.remainingMs(now) / 1000);
    switch (this.cycle.phase) {
      case "fill":
        return "CẤP NƯỚC";
      case "wash":
        return `GIẶT 0:${String(s).padStart(2, "0")}`;
      case "spin":
        return "VẮT KHÔ";
      case "unload":
      case "hang":
        return "XONG!";
      default:
        return "SẴN SÀNG";
    }
  }

  // ---------- Bám mặt trong ô cửa ----------

  private trackFace(face: FaceLandmarkerResult | undefined, dt: number) {
    const lm = face?.faceLandmarks?.[0];
    let tx = 0.5, ty = 0.5, ts = 0.9;
    if (lm) {
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const p of lm) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      // Không gian hiển thị: lật gương theo x, y hướng lên.
      tx = 1 - (minX + maxX) / 2;
      ty = 1 - ((minY + maxY) / 2 + (maxY - minY) * 0.15);
      ts = THREE.MathUtils.clamp((maxY - minY) * 2.6, 0.35, 1);
    }
    const k = 1 - Math.exp(-dt * 4);
    this.center.x += (tx - this.center.x) * k;
    this.center.y += (ty - this.center.y) * k;
    this.span += (ts - this.span) * k;
  }

  // ---------- Dựng cảnh ----------

  private buildRoom() {
    const BIG = 4000;
    this.root.add(mesh(new THREE.PlaneGeometry(BIG, BIG), flat(COLOR.wall), 0, 0, -1));
    this.root.add(mesh(new THREE.PlaneGeometry(BIG, 26), flat(COLOR.wainscot), 0, FLOOR_Y + 13, -0.95));
    this.root.add(mesh(new THREE.PlaneGeometry(BIG, 1), flat(COLOR.trim), 0, FLOOR_Y + 26, -0.94));

    const tile = document.createElement("canvas");
    tile.width = tile.height = 64;
    const g = tile.getContext("2d")!;
    g.fillStyle = COLOR.floorA;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = COLOR.floorB;
    g.fillRect(0, 0, 32, 32);
    g.fillRect(32, 32, 32, 32);
    const tex = new THREE.CanvasTexture(tile);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(BIG / 14, 200 / 14);
    this.root.add(mesh(new THREE.PlaneGeometry(BIG, 200), flat("#ffffff", { map: tex }), 0, FLOOR_Y - 100, -0.9));
    this.root.add(mesh(new THREE.PlaneGeometry(BIG, 1.2), flat(COLOR.trim), 0, FLOOR_Y, -0.89));

    // Dãy máy giặt phụ phía sau, nhạt màu.
    for (const x of [-50, -92, 50, 92]) this.root.add(this.sideMachine(x));
  }

  private sideMachine(x: number) {
    const gr = new THREE.Group();
    gr.position.set(x, MACHINE.y - 3, -0.6);
    gr.add(mesh(roundedRect(40, 50, 2.5), flat(COLOR.side)));
    gr.add(mesh(roundedRect(36, 7, 1.2), flat("#d8e8ed"), 0, 19, 0.05));
    gr.add(mesh(roundedRect(11, 4, 0.6), flat(COLOR.sideDark), -6, 19, 0.1));
    gr.add(mesh(new THREE.CircleGeometry(1.4, 24), flat(COLOR.start), 6, 19, 0.1));
    gr.add(mesh(new THREE.CircleGeometry(1.4, 24), flat(COLOR.stop), 10.5, 19, 0.1));
    gr.add(mesh(new THREE.RingGeometry(11, 14, 48), flat(COLOR.ring), 0, -4, 0.1));
    gr.add(mesh(new THREE.CircleGeometry(11, 48), flat(COLOR.sideDark), 0, -4, 0.05));
    return gr;
  }

  private buildMachine(): Record<Action, THREE.Mesh> {
    const m = this.machine;
    const { w, h, y } = MACHINE;
    m.add(mesh(roundedRect(w + 1.5, h + 1.5, 4), flat(COLOR.bodyShade), 0.8, y - 1, 0));
    m.add(mesh(roundedRect(w, h, 3.5), flat(COLOR.body), 0, y, 0.05));
    m.add(mesh(new THREE.PlaneGeometry(w - 4, 0.4), flat(COLOR.bodyShade), 0, PANEL_Y - 6.2, 0.08));
    m.add(mesh(roundedRect(w - 5, 9, 1.8), flat(COLOR.panel), 0, PANEL_Y, 0.1));

    const screen = mesh(roundedRect(17, 6.2, 0.8), flat("#ffffff", { map: this.display.texture }), -9, PANEL_Y, 0.15);
    // ShapeGeometry tạo UV theo toạ độ; chuẩn hoá về 0..1 để texture phủ đúng màn hình.
    normalizeUv(screen.geometry);
    m.add(screen);

    const button = (action: Action, x: number, color: string, text: string) => {
      const b = mesh(new THREE.CircleGeometry(3.3, 40), flat(color), x, PANEL_Y, 0.15);
      const label = new Label(128, 64, { color: "#1f3a4a", font: "800 30px system-ui, sans-serif" });
      label.set(text);
      b.add(mesh(new THREE.PlaneGeometry(5.2, 2.6), flat("#ffffff", { map: label.texture, transparent: true }), 0, 0, 0.05));
      b.userData.action = action;
      m.add(b);
      return b;
    };
    const start = button("start", 7.5, COLOR.start, "GIẶT");
    const stop = button("stop", 15.5, COLOR.stop, "DỪNG");

    m.add(mesh(new THREE.CircleGeometry(DOOR.ring + 1.2, 64), flat(COLOR.bodyShade), 0.6, DOOR.y - 0.8, 0.1));
    m.add(mesh(new THREE.CircleGeometry(DOOR.R, 72), this.drum, 0, DOOR.y, 0.12));
    m.add(mesh(new THREE.RingGeometry(DOOR.R - 0.7, DOOR.R, 72), flat(COLOR.ringDark), 0, DOOR.y, 0.3));
    m.add(mesh(new THREE.RingGeometry(DOOR.R, DOOR.ring, 72), flat(COLOR.ring), 0, DOOR.y, 0.3));
    m.add(mesh(new THREE.RingGeometry(DOOR.ring - 0.6, DOOR.ring, 72), flat("#e9eef0"), 0, DOOR.y, 0.31));
    m.add(mesh(roundedRect(2.2, 7, 1), flat(COLOR.ringDark), DOOR.ring + 0.3, DOOR.y, 0.32));
    m.add(mesh(new THREE.PlaneGeometry(10, 0.6), flat(COLOR.sideDark), 12, y - h / 2 + 3, 0.1));
    return { start, stop };
  }

  private buildTumble() {
    this.tumble.position.set(0, DOOR.y, 0.2);
    this.machine.add(this.tumble);
    const R = DOOR.R - 4;
    for (let i = 0; i < MAX_CLOTHES; i++) {
      const size = 3 + Math.random() * 2.5;
      const m = mesh(blob(size), flat(CLOTH_COLORS[i % CLOTH_COLORS.length]));
      // Đống quần áo nằm ở đáy lồng.
      const px = (i / (MAX_CLOTHES - 1) - 0.5) * 2 * R * 0.8;
      const py = -Math.sqrt(Math.max(0, R * R - px * px)) * 0.75 + Math.random() * 2;
      this.clothes.push({
        mesh: m,
        pile: new THREE.Vector2(px, py),
        pileRot: Math.random() * Math.PI,
        orbit: R * (0.45 + Math.random() * 0.5),
        phase: (i / MAX_CLOTHES) * Math.PI * 2,
        selfSpin: 0.5 + Math.random(),
      });
      m.position.z = i * 0.01;
      this.tumble.add(m);
    }
    const bubbleGeo = new THREE.CircleGeometry(0.5, 12);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const m = mesh(bubbleGeo, flat(COLOR.foam, { transparent: true, opacity: 0.7 }));
      m.position.z = 0.3;
      m.visible = false;
      this.bubbles.push({ mesh: m, x: 0, y: -DOOR.R, speed: 2 + Math.random() * 4 });
      this.tumble.add(m);
    }
    this.setQuality(this.quality);
  }

  private lineY(x: number) {
    const t = this.half ? x / this.half : 0;
    return LINE_Y - SAG * (1 - t * t);
  }

  private buildLine(half: number) {
    this.half = half;
    if (this.line) {
      this.root.remove(this.line);
      this.line.geometry.dispose();
    }
    const pts = Array.from({ length: 33 }, (_, i) => {
      const x = -half + (i / 32) * half * 2;
      return new THREE.Vector3(x, this.lineY(x), 0.6);
    });
    this.line = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.22, 5), flat(COLOR.line));
    this.root.add(this.line);
  }

  // ---------- Hoạt cảnh ----------

  private animateClothes(now: number, water: number) {
    const a = this.agitation;
    const surface = -DOOR.R + DOOR.R * 2 * water;
    this.clothes.forEach((c) => {
      const ang = this.spin * 0.9 + c.phase;
      const ox = Math.cos(ang) * c.orbit;
      const oy = Math.sin(ang) * c.orbit;
      // Khi lồng đứng yên, quần áo nằm ở đáy và nổi dần lên theo mực nước; khi quay, chúng bị cuốn theo.
      const floatY = water > 0.02 ? Math.max(c.pile.y, Math.min(surface - 1.5, c.pile.y + 7)) : c.pile.y;
      const bob = Math.sin(now / 400 + c.phase) * (water > 0.02 ? 0.8 : 0.3) * (1 - a);
      c.mesh.position.x = THREE.MathUtils.lerp(c.pile.x, ox, a);
      c.mesh.position.y = THREE.MathUtils.lerp(floatY + bob, oy, a);
      c.mesh.rotation.z = c.pileRot + this.spin * c.selfSpin * a;
    });
  }

  private animateBubbles(dt: number, water: number) {
    const surface = -DOOR.R + DOOR.R * 2 * water;
    const show = water > 0.03;
    this.bubbles.forEach((b, i) => {
      b.mesh.visible = show && i < this.quality.bubbles;
      if (!b.mesh.visible) return;
      b.y += b.speed * dt * (1 + this.agitation * 2);
      if (b.y > surface || b.y < -DOOR.R) {
        b.y = -DOOR.R + 1 + Math.random() * 3;
        b.x = (Math.random() - 0.5) * DOOR.R * 1.4;
      }
      const wob = Math.sin(b.y * 1.7 + i) * 0.4;
      b.mesh.position.set(b.x + wob, b.y, 0.3);
      b.mesh.scale.setScalar(0.5 + ((i * 7) % 5) * 0.25);
    });
  }

  private animateButtons(now: number) {
    for (const [action, b] of Object.entries(this.buttons) as [Action, THREE.Mesh][]) {
      const t = this.pressedAt.get(b);
      const press = t ? Math.max(0, 1 - (now - t) / 200) : 0;
      // Nút GIẶT "thở" nhẹ khi máy rảnh để gợi ý bấm.
      const pulse = action === "start" && this.cycle.phase === "idle" ? 1 + 0.05 * Math.sin(now / 250) : 1;
      b.scale.setScalar(pulse * (1 - 0.12 * press));
    }
  }

  /** Lấy đồ ra khỏi lồng: ảnh nhăn nhúm bật ra, rồi được giũ ở SHAKE_SPOT. */
  private takeOut(cut: Cutout, now: number) {
    // Cùng quy ước màu với ô cửa: shader dùng thẳng giá trị sRGB.
    const tex = new THREE.CanvasTexture(cut.canvas);
    tex.colorSpace = THREE.NoColorSpace;
    const geo = new THREE.PlaneGeometry(CUT_SIZE.w, CUT_SIZE.h, 20, 22);
    // Cho vui: thỉnh thoảng phơi ngược (kẹp ở vai).
    const upsideDown = this.hungCount++ % 3 === 2;
    // Kéo mép có nội dung (đỉnh tóc, hoặc vai nếu treo ngược) lên sát chỗ kẹp; chừa 0.8 đơn vị cho kẹp ngậm vào.
    const pad = (upsideDown ? cut.padBottom : cut.padTop) * CUT_SIZE.h - 0.8;
    geo.translate(0, -CUT_SIZE.h / 2, 0);
    if (upsideDown) geo.rotateZ(Math.PI).translate(0, -CUT_SIZE.h, 0);
    geo.translate(0, Math.max(0, pad), 0);
    const material = new THREE.ShaderMaterial({
      vertexShader: CARD_VERTEX,
      fragmentShader: CARD_FRAGMENT,
      uniforms: {
        map: { value: tex },
        opacity: { value: 1 },
        wrinkle: { value: 1 },
        wave: { value: 0 },
        phase: { value: 0 },
        height: { value: CUT_SIZE.h },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const card = new THREE.Mesh(geo, material);
    const pivot = new THREE.Group();
    pivot.add(card);
    for (const x of [-CUT_SIZE.w * 0.28, CUT_SIZE.w * 0.28]) {
      // Đặt kẹp trước nếp vải gồ lên nhiều nhất để không bị vải che.
      pivot.add(mesh(roundedRect(1, 3, 0.3), flat(COLOR.peg), x, -0.6, 3));
    }
    pivot.position.set(0, DOOR.y, SHAKE_SPOT.z);
    pivot.scale.setScalar(0.35);
    this.root.add(pivot);
    this.hung.push({
      pivot,
      card,
      born: now,
      flyAt: 0,
      from: new THREE.Vector3(),
      snaps: 0,
      sway: Math.random() * Math.PI * 2,
      falling: 0,
      fallFrom: new THREE.Vector3(),
    });
  }

  private drop(h: Hung, now: number) {
    if (h.falling) return;
    h.falling = now;
    h.fallFrom.copy(h.pivot.position);
  }

  /** Giũ: bật ra khỏi lồng, rồi giật lên–quật xuống UNLOAD.snaps lần, mỗi lần phẳng thêm và văng nước. */
  private animateUnload(h: Hung, now: number) {
    const u = h.card.material.uniforms;
    const t = now - h.born;
    if (t < UNLOAD.popMs) {
      const e = easeOut(t / UNLOAD.popMs);
      h.pivot.position.set(
        0,
        THREE.MathUtils.lerp(DOOR.y, SHAKE_SPOT.y, e) + Math.sin(e * Math.PI) * 6,
        SHAKE_SPOT.z,
      );
      h.pivot.scale.setScalar(0.35 + 0.65 * e);
      h.pivot.rotation.z = Math.sin(e * Math.PI * 3) * 0.25 * (1 - e);
      u.wrinkle.value = 1;
      u.wave.value = 0;
      return;
    }
    const s = (t - UNLOAD.popMs) / UNLOAD.snapMs;
    const i = Math.floor(s);
    h.pivot.scale.setScalar(1);
    h.pivot.rotation.z = 0;
    if (i >= UNLOAD.snaps) {
      h.pivot.position.copy(SHAKE_SPOT);
      u.wrinkle.value = 0;
      u.wave.value *= 0.9;
      return;
    }
    const k = s - i;
    if (h.snaps <= i) {
      h.snaps = i + 1;
      // Lần giũ đầu văng nhiều nước nhất.
      this.splash(SHAKE_SPOT.x, SHAKE_SPOT.y - CUT_SIZE.h * 0.9, 12 - i * 3);
    }
    // Giật lên rồi quật xuống thật nhanh.
    h.pivot.position.set(SHAKE_SPOT.x, SHAKE_SPOT.y + 3.2 * Math.sin(k * Math.PI * 2) * (1 - k), SHAKE_SPOT.z);
    u.wave.value = Math.sin(k * Math.PI);
    u.phase.value = k * Math.PI * 3;
    u.wrinkle.value = 1 - (i + smoothstep(k)) / UNLOAD.snaps;
  }

  private animateHung(now: number, dt: number) {
    const slots = THREE.MathUtils.clamp(Math.floor((this.half * 1.8) / SLOT_GAP), 1, 6);
    const alive = this.hung.filter((h) => !h.falling);
    alive.slice(0, Math.max(0, alive.length - slots)).forEach((h) => this.drop(h, now));
    const shown = alive.slice(-slots);
    // Dàn đều các ảnh quanh giữa dây; dây đầy thì ảnh cũ nhất (bên trái) rơi xuống.
    const spread = shown.length * SLOT_GAP;

    shown.forEach((h, i) => {
      if (!h.flyAt) return this.animateUnload(h, now);
      const u = h.card.material.uniforms;
      const x = -spread / 2 + (i + 0.5) * SLOT_GAP;
      const target = new THREE.Vector3(x, this.lineY(x) + 0.2, 1);
      const t = (now - h.flyAt) / FLY_MS;
      if (t < 1) {
        if (!h.from.lengthSq()) h.from.copy(h.pivot.position);
        // Bay theo đường cong từ chỗ giũ lên dây, vải phấp phới.
        const e = 1 - Math.pow(1 - t, 3);
        const ctrl = new THREE.Vector3((h.from.x + x) / 2, Math.max(h.from.y, target.y) + 10, 1);
        const p = h.from.clone().multiplyScalar((1 - e) ** 2).add(ctrl.multiplyScalar(2 * (1 - e) * e)).add(target.clone().multiplyScalar(e * e));
        h.pivot.position.copy(p);
        h.pivot.rotation.z = Math.sin(e * Math.PI) * 0.3;
        u.wrinkle.value = 0;
        u.wave.value = 0.45 * (1 - e);
        u.phase.value = now / 120;
        return;
      }
      h.pivot.position.lerp(target, 1 - Math.exp(-dt * 4));
      h.pivot.rotation.z = Math.sin((now / 1000) * 1.6 + h.sway) * 0.07;
      // Gió nhẹ làm vải gợn sóng.
      u.wave.value = 0.12;
      u.phase.value = now / 700 + h.sway;
    });

    this.hung = this.hung.filter((h) => {
      if (!h.falling) return true;
      const t = (now - h.falling) / FALL_MS;
      if (t >= 1) {
        this.root.remove(h.pivot);
        h.pivot.traverse((o) => {
          if (o instanceof THREE.Mesh) disposeMesh(o);
        });
        return false;
      }
      h.pivot.position.set(h.fallFrom.x, h.fallFrom.y - 60 * t * t, 1);
      h.pivot.rotation.z += dt * 3;
      h.card.material.uniforms.opacity.value = 1 - t;
      return true;
    });
  }

  private buildDrops() {
    const geo = new THREE.CircleGeometry(0.45, 10);
    for (let i = 0; i < MAX_DROPS; i++) {
      const m = mesh(geo, flat("#9fd8f0", { transparent: true }), 0, 0, 2.5);
      m.visible = false;
      this.root.add(m);
      this.drops.push({ mesh: m, vel: new THREE.Vector2(), born: 0 });
    }
  }

  private splash(x: number, y: number, n: number) {
    for (const d of this.drops) {
      if (n <= 0) break;
      if (d.mesh.visible) continue;
      n--;
      d.mesh.visible = true;
      d.born = performance.now();
      d.mesh.position.set(x + (Math.random() - 0.5) * CUT_SIZE.w, y + Math.random() * 4, 2.5);
      d.vel.set((Math.random() - 0.5) * 30, 4 + Math.random() * 14);
      d.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
    }
  }

  private animateDrops(now: number, dt: number) {
    for (const d of this.drops) {
      if (!d.mesh.visible) continue;
      const t = (now - d.born) / DROP_LIFE_MS;
      if (t >= 1) {
        d.mesh.visible = false;
        continue;
      }
      d.vel.y -= 80 * dt;
      d.mesh.position.x += d.vel.x * dt;
      d.mesh.position.y += d.vel.y * dt;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    }
  }
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function disposeMesh(o: THREE.Mesh) {
  o.geometry.dispose();
  const materials = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of materials) {
    (m as THREE.MeshBasicMaterial).map?.dispose();
    (m as THREE.ShaderMaterial).uniforms?.map?.value?.dispose?.();
    m.dispose();
  }
}

/** Mảnh vải: đa giác lồi lõm ngẫu nhiên. */
function blob(size: number) {
  const s = new THREE.Shape();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = size * (0.7 + Math.random() * 0.5);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.75;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return new THREE.ShapeGeometry(s);
}

function normalizeUv(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  uv.needsUpdate = true;
}
