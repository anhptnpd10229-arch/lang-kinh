// Âm thanh tổng hợp hoàn toàn bằng Web Audio (không cần tệp âm thanh).
// AudioContext chỉ được tạo khi người dùng bấm bật âm thanh (chính sách tự phát của trình duyệt).
// - activate: tiếng "vút" sáng khi quả cầu thành hình.
// - charge: tiếng trầm rền to dần và sáng dần theo mức nạp.
// - release: tiếng nổ năng lượng: nhiễu quét + âm trầm rơi.

export class MagicAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: { gain: GainNode; filter: BiquadFilterNode; oscs: OscillatorNode[] } | null = null;
  private noise: AudioBuffer | null = null;
  enabled = false;

  /** Bật/tắt; phải được gọi trong sự kiện người dùng bấm. */
  async setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.setCharge(0);
      await this.ctx?.suspend();
      return;
    }
    if (!this.ctx) this.init();
    await this.ctx?.resume();
  }

  activate() {
    const c = this.ready();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 1);
    this.noiseBurst(t, 0.7, 1800, 6000, 0.08);
  }

  /** Mức nạp 0→1; 0 thì tắt tiếng rền. */
  setCharge(level: number) {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (level <= 0.001 || !this.enabled) {
      if (this.drone) {
        const d = this.drone;
        this.drone = null;
        d.gain.gain.setTargetAtTime(0, c.currentTime, 0.12);
        d.oscs.forEach((o) => o.stop(c.currentTime + 0.6));
      }
      return;
    }
    if (!this.drone) {
      const gain = c.createGain();
      gain.gain.value = 0;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 6;
      const oscs = [55, 55.7, 110.4].map((f, i) => {
        const o = c.createOscillator();
        o.type = i === 2 ? "triangle" : "sawtooth";
        o.frequency.value = f;
        o.connect(filter);
        o.start();
        return o;
      });
      filter.connect(gain).connect(this.master);
      this.drone = { gain, filter, oscs };
    }
    const t = c.currentTime;
    this.drone.gain.gain.setTargetAtTime(0.05 + level * 0.18, t, 0.08);
    this.drone.filter.frequency.setTargetAtTime(180 + level * 1600, t, 0.08);
  }

  release(power: number) {
    const c = this.ready();
    if (!c) return;
    this.setCharge(0);
    const t = c.currentTime;
    this.noiseBurst(t, 1.2, 600, 9000, 0.35 * (0.6 + power * 0.5));
    const sub = c.createOscillator();
    const g = c.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * (0.5 + power * 0.5), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    sub.connect(g).connect(this.master!);
    sub.start(t);
    sub.stop(t + 1.2);
  }

  dispose() {
    this.drone?.oscs.forEach((o) => o.stop());
    this.drone = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  private init() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    const comp = c.createDynamicsCompressor();
    this.master = c.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(comp).connect(c.destination);
    // 1 giây nhiễu trắng dùng lại cho mọi tiếng nổ/vút.
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.ctx = c;
  }

  private ready() {
    return this.enabled && this.ctx && this.master ? this.ctx : null;
  }

  /** Nhiễu qua bộ lọc thông dải quét từ `f0` tới `f1`. */
  private noiseBurst(t: number, dur: number, f0: number, f1: number, level: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur);
  }
}
