// Bộ điều phối AETHER: kết quả tay → đặc trưng → cử chỉ → máy trạng thái → cảnh hiệu ứng, âm thanh, hậu kỳ,
// và trạng thái hiển thị cho lớp giao diện (qua EffectBus).
import type { GestureRecognizerResult } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import type { EffectBus } from "@/core/bus";
import { MagicAudio } from "./audio/MagicAudio";
import { EnergyScene, type SceneInput } from "./effects/EnergyScene";
import { AETHER_QUALITY, type AetherQuality } from "./effects/uniforms";
import { MagicStateMachine, type MagicEvent } from "./magic/MagicStateMachine";
import { EnergyComposer } from "./render/EnergyComposer";
import { GestureClassifier, MIN_CONFIDENCE } from "./tracking/GestureClassifier";
import { handFrame, type HandFrame } from "./tracking/handFeatures";
import { MotionSmoother } from "./tracking/MotionSmoother";
import { AETHER_COMMANDS, type AetherUi } from "./ui";

/** Mặt phẳng đặt quả cầu, cách camera (đơn vị cảnh). */
export const DEPTH = 40;
/** Bán kính quả cầu so với chiều dài lòng bàn tay. */
const ORB_RATIO = 0.42;

const MESSAGES: Partial<Record<MagicEvent, string>> = {
  summon: "Năng lượng đang hội tụ…",
  charge: "Đang nạp — giữ nắm tay",
  release: "Giải phóng!",
  fizzle: "Năng lượng tan đi — nắm tay để nạp lại",
};

export class AetherRuntime {
  readonly scene: EnergyScene;
  private composer: EnergyComposer;
  private machine = new MagicStateMachine();
  private classifier = new GestureClassifier();
  private smoother = new MotionSmoother();
  private audio = new MagicAudio();
  private frame: HandFrame | null = null;
  private lastTs = -1;
  private lastSeen = -Infinity;
  private flash = 0;
  private everTracked = false;
  private input: SceneInput = {
    state: "IDLE",
    progress: 0,
    charge: 0,
    releasePower: 0,
    presence: 0,
    pinching: false,
    target: new THREE.Vector3(),
    radius: 1,
    roll: 0,
    facing: 1,
    palm: new THREE.Vector3(),
    thumb: new THREE.Vector3(),
    index: new THREE.Vector3(),
    tracked: false,
  };
  private unsubscribe: () => void;

  constructor(
    private video: HTMLVideoElement,
    private bus: EffectBus,
    quality: AetherQuality,
    private notify?: (m: string) => void,
  ) {
    this.scene = new EnergyScene(quality);
    this.composer = new EnergyComposer(video);
    this.composer.setScale(quality.fxScale);
    this.machine.onEvent = (e) => this.onMagic(e);
    this.unsubscribe = bus.onCommand((cmd) => this.command(cmd));
    bus.set({ state: "IDLE", tracking: "searching", gesture: "none", charge: 0, sound: false } satisfies AetherUi);
  }

  setQuality(q: keyof typeof AETHER_QUALITY) {
    const settings = AETHER_QUALITY[q];
    this.scene.setQuality(settings);
    this.composer.setScale(settings.fxScale);
  }

  setNotify(fn?: (m: string) => void) {
    this.notify = fn;
  }

  /** Cập nhật mỗi khung hình. `w`, `h`: kích thước khung nhìn ở mặt phẳng DEPTH (đơn vị cảnh). */
  update(result: GestureRecognizerResult | undefined, ts: number, now: number, dt: number, w: number, h: number, camera: THREE.Camera, pixelScale: number) {
    if (result && ts !== this.lastTs) {
      this.lastTs = ts;
      this.ingest(result, ts, w, h);
    }
    this.machine.update(now, dt);
    if (now - this.lastSeen > 120) this.input.tracked = false;

    const m = this.machine;
    const i = this.input;
    i.state = m.state;
    i.progress = m.progress(now);
    i.charge = m.charge;
    i.releasePower = m.releasePower;
    i.presence = m.presence;
    i.pinching = m.pinching;

    this.scene.pointScale.value = pixelScale;
    this.scene.update(now, dt, i, camera);

    // Ánh sáng màn hình khi nạp, chớp sáng khi giải phóng.
    this.flash = Math.max(0, this.flash - dt * 5);
    this.composer.uniforms.uFlash.value = this.flash * this.flash * 0.55;
    this.composer.uniforms.uGlow.value = m.state === "CHARGING" ? m.charge * 0.2 * m.presence : 0;
    this.audio.setCharge(m.state === "CHARGING" ? m.charge * m.presence : 0);

    const tracking: AetherUi["tracking"] = i.tracked ? "tracked" : this.everTracked ? "lost" : "searching";
    this.bus.set({ state: m.state, tracking, charge: Math.round(m.charge * 20) / 20 });
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, dt: number) {
    this.composer.render(renderer, scene, camera, dt);
  }

  dispose() {
    this.unsubscribe();
    this.scene.dispose();
    this.composer.dispose();
    this.audio.dispose();
  }

  private ingest(result: GestureRecognizerResult, ts: number, w: number, h: number) {
    // Chọn bàn tay có độ tin cậy cao nhất.
    let best = -1;
    let bestScore = 0;
    result.landmarks.forEach((_, k) => {
      const s = result.handedness?.[k]?.[0]?.score ?? 1;
      if (s > bestScore) [best, bestScore] = [k, s];
    });
    const aspect = this.video.videoWidth / (this.video.videoHeight || 1) || 4 / 3;
    this.frame = best >= 0 && bestScore >= MIN_CONFIDENCE
      ? handFrame(result.landmarks[best], result.worldLandmarks?.[best], bestScore, aspect)
      : null;

    const reading = this.classifier.update(this.frame, ts);
    this.machine.input(reading, ts);
    this.bus.set({ gesture: reading.gesture });

    const f = this.frame;
    if (!f) {
      this.smoother.reset();
      return;
    }
    this.lastSeen = ts;
    this.everTracked = true;
    const s = this.smoother.update(f.palm.x, f.palm.y, f.scale, f.roll, ts / 1000);
    const toScene = (x: number, y: number, out: THREE.Vector3) => out.set((x - 0.5) * w, (0.5 - y) * h, -DEPTH);
    const i = this.input;
    i.tracked = true;
    toScene(s.x, s.y, i.palm);
    toScene(f.thumbTip.x, f.thumbTip.y, i.thumb);
    toScene(f.indexTip.x, f.indexTip.y, i.index);
    // Quả cầu lơ lửng phía trên lòng bàn tay, dịch về phía các ngón và hơi tiến ra trước.
    const palmLen = s.scale * h;
    i.radius = palmLen * ORB_RATIO;
    i.target.copy(i.palm);
    i.target.x += Math.sin(s.roll) * palmLen * 0.45;
    i.target.y += Math.cos(s.roll) * palmLen * 0.45;
    i.target.z += palmLen * 0.4;
    i.roll = s.roll;
    i.facing = f.facing;
  }

  private onMagic(e: MagicEvent) {
    const text = MESSAGES[e];
    if (text) this.notify?.(text);
    if (e === "summon") {
      this.scene.reset();
      this.audio.activate();
    }
    if (e === "release") {
      this.flash = 1;
      this.audio.release(this.machine.releasePower);
    }
    if (e === "restart") this.scene.reset();
  }

  private command(cmd: string) {
    const now = performance.now();
    switch (cmd) {
      case AETHER_COMMANDS.restart:
        this.classifier.reset();
        this.machine.restart(now);
        this.notify?.("Đã khởi động lại — xoè tay để triệu hồi");
        break;
      case AETHER_COMMANDS.release:
        if (!this.machine.release(now, true)) this.notify?.("Hãy triệu hồi quả cầu trước (xoè tay)");
        break;
      case AETHER_COMMANDS.soundOn:
      case AETHER_COMMANDS.soundOff: {
        const on = cmd === AETHER_COMMANDS.soundOn;
        void this.audio.setEnabled(on);
        this.bus.set({ sound: on });
        break;
      }
    }
  }
}
