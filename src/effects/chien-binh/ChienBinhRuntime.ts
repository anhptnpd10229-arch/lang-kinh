// Bộ điều phối: kết quả tư thế → đặc trưng + khớp đã làm mượt → máy trạng thái → cảnh giáp, âm thanh,
// và trạng thái hiển thị cho Overlay (qua EffectBus).
import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import type { EffectBus } from "@/core/bus";
import { OneEuroFilter } from "@/core/one-euro";
import type { Quality } from "@/core/perf";
import { ArmorScene, type ArmorQuality, type Rig } from "./armor/ArmorScene";
import { ArmorAudio } from "./audio/ArmorAudio";
import { TransformMachine, type ArmorEvent } from "./magic/TransformMachine";
import { bodyFrame, IDX, type Joint } from "./pose/bodyFeatures";
import { ARMOR_COMMANDS, type ArmorUi } from "./ui";

export const DEPTH = 50;

export const ARMOR_QUALITY: Record<Quality, ArmorQuality> = {
  high: { spiral: 900, sparks: 400 },
  medium: { spiral: 550, sparks: 260 },
  low: { spiral: 260, sparks: 140 },
};

const MESSAGES: Partial<Record<ArmorEvent, string>> = {
  arming: "Giờ dang mạnh hai tay ra!",
  cancel: "Chưa biến hình — bắt chéo tay rồi dang ra nhé",
  transform: "Biến hình!",
  armored: "Biến hình hoàn tất! Giơ hai tay lên để bùng năng lượng",
  power: "Năng lượng bùng nổ!",
  detransform: "Tháo giáp…",
};

const LOST_MS = 400;
const JOINTS = Object.keys(IDX) as Joint[];

export class ChienBinhRuntime {
  readonly scene: ArmorScene;
  private machine = new TransformMachine();
  private audio = new ArmorAudio();
  private filters = new Map<Joint, [OneEuroFilter, OneEuroFilter]>(
    JOINTS.map((j) => [j, [new OneEuroFilter(1.5, 3), new OneEuroFilter(1.5, 3)]]),
  );
  private rig: Rig = {
    shL: new THREE.Vector3(),
    shR: new THREE.Vector3(),
    elL: new THREE.Vector3(),
    elR: new THREE.Vector3(),
    wrL: new THREE.Vector3(),
    wrR: new THREE.Vector3(),
    head: new THREE.Vector3(),
    headW: 1,
    headRoll: 0,
    headYaw: 0,
    headVisible: false,
    armsVisible: false,
    sw: 1,
  };
  private lastTs = -1;
  private lastSeen = -Infinity;
  private everSeen = false;
  private unsubscribe: () => void;

  constructor(
    private video: HTMLVideoElement,
    private bus: EffectBus,
    quality: Quality,
    private notify?: (m: string) => void,
  ) {
    this.scene = new ArmorScene(ARMOR_QUALITY[quality]);
    this.scene.onLand = (kind) => this.audio.clank(kind === "helmet" ? 0.8 : 1 + Math.random() * 0.15);
    this.machine.onEvent = (e) => this.onArmor(e);
    this.unsubscribe = bus.onCommand((cmd) => this.command(cmd));
    bus.set({ state: "IDLE", tracking: "searching", sound: false } satisfies ArmorUi);
  }

  setQuality(q: Quality) {
    this.scene.setQuality(ARMOR_QUALITY[q]);
  }

  setNotify(fn?: (m: string) => void) {
    this.notify = fn;
  }

  update(result: PoseLandmarkerResult | undefined, ts: number, now: number, dt: number, w: number, h: number) {
    if (result && ts !== this.lastTs) {
      this.lastTs = ts;
      this.ingest(result, ts, w, h);
    }
    this.machine.update(now);
    const tracked = now - this.lastSeen < LOST_MS;
    this.scene.update(now, dt, tracked ? this.rig : null, this.machine.state, this.machine.since);
    this.bus.set({ state: this.machine.state, tracking: tracked ? "tracked" : this.everSeen ? "lost" : "searching" });
  }

  dispose() {
    this.unsubscribe();
    this.scene.dispose();
    this.audio.dispose();
  }

  private ingest(result: PoseLandmarkerResult, ts: number, w: number, h: number) {
    const lm = result.landmarks?.[0];
    const aspect = this.video.videoWidth / (this.video.videoHeight || 1) || 4 / 3;
    const body = bodyFrame(lm, aspect);
    this.machine.input(body, ts);
    if (!body || !lm) {
      if (ts - this.lastSeen > LOST_MS) this.filters.forEach((f) => f.forEach((x) => x.reset()));
      return;
    }
    this.lastSeen = ts;
    this.everSeen = true;

    const t = ts / 1000;
    const world = (j: Joint, out: THREE.Vector3) => {
      const p = lm[IDX[j]];
      const [fx, fy] = this.filters.get(j)!;
      return out.set((fx.filter(p.x, t) - 0.5) * w, (0.5 - fy.filter(p.y, t)) * h, -DEPTH);
    };
    const r = this.rig;
    world("shL", r.shL);
    world("shR", r.shR);
    world("elL", r.elL);
    world("elR", r.elR);
    world("wrL", r.wrL);
    world("wrR", r.wrR);
    r.sw = Math.max(0.5, r.shL.distanceTo(r.shR));
    r.armsVisible = body.armsVisible;

    // Đầu: ưu tiên hai tai; tai bị che thì ước theo hai mắt.
    const vis = (j: Joint) => lm[IDX[j]].visibility ?? 1;
    const earL = world("earL", new THREE.Vector3());
    const earR = world("earR", new THREE.Vector3());
    const eyeL = world("eyeL", new THREE.Vector3());
    const eyeR = world("eyeR", new THREE.Vector3());
    const nose = world("nose", new THREE.Vector3());
    const ears = vis("earL") > 0.4 && vis("earR") > 0.4;
    const a = ears ? earL : eyeL;
    const b = ears ? earR : eyeR;
    const span = a.distanceTo(b) * (ears ? 1 : 2.3);
    r.headVisible = vis("nose") > 0.5 && span > r.sw * 0.25;
    r.headW = span;
    r.head.addVectors(a, b).multiplyScalar(0.5);
    r.head.y += span * 0.12;
    r.headRoll = Math.atan2(a.y - b.y, a.x - b.x);
    r.headYaw = THREE.MathUtils.clamp((nose.x - r.head.x) / (span / 2), -1, 1) * 0.9;
  }

  private onArmor(e: ArmorEvent) {
    const text = MESSAGES[e];
    if (text) this.notify?.(text);
    if (e === "transform") this.audio.whoosh();
    if (e === "armored") this.audio.powerUp();
    if (e === "detransform") this.audio.powerDown();
    if (e === "power") {
      this.audio.burst();
      this.scene.power(performance.now(), performance.now() - this.lastSeen < LOST_MS ? this.rig : null);
    }
  }

  private command(cmd: string) {
    switch (cmd) {
      case ARMOR_COMMANDS.toggle:
        if (!this.machine.toggle(performance.now())) this.notify?.("Đợi biến hình xong đã");
        break;
      case ARMOR_COMMANDS.soundOn:
      case ARMOR_COMMANDS.soundOff: {
        const on = cmd === ARMOR_COMMANDS.soundOn;
        void this.audio.setEnabled(on);
        this.bus.set({ sound: on });
        break;
      }
    }
  }
}
