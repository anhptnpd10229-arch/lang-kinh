// Âm thanh biến hình tổng hợp bằng Web Audio (không cần tệp). Chỉ tạo AudioContext khi người dùng bấm bật.
// whoosh: luồng gió xoáy lúc bắt đầu; clank: tiếng kim loại khi từng mảnh giáp gắn vào;
// powerUp: hợp âm vang lên khi biến hình xong; burst: bùng năng lượng; powerDown: tháo giáp.

export class ArmorAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = false;

  async setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      await this.ctx?.suspend();
      return;
    }
    if (!this.ctx) this.init();
    await this.ctx?.resume();
  }

  whoosh() {
    const c = this.ready();
    if (!c) return;
    this.noiseSweep(c.currentTime, 1.6, 300, 4200, 0.22);
  }

  clank(pitch = 1) {
    const c = this.ready();
    if (!c) return;
    const t = c.currentTime;
    this.noiseSweep(t, 0.18, 2500 * pitch, 6000 * pitch, 0.18);
    for (const [f, lvl] of [[620, 0.12], [1490, 0.06]] as const) this.tone(t, f * pitch, f * pitch * 0.98, 0.35, lvl, "triangle");
  }

  powerUp() {
    const c = this.ready();
    if (!c) return;
    const t = c.currentTime;
    [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone(t + i * 0.06, f, f, 1.4, 0.07, "sawtooth"));
    this.tone(t, 110, 220, 0.9, 0.12, "sine");
  }

  burst() {
    const c = this.ready();
    if (!c) return;
    const t = c.currentTime;
    this.noiseSweep(t, 0.9, 500, 8000, 0.25);
    this.tone(t, 160, 40, 0.8, 0.35, "sine");
  }

  powerDown() {
    const c = this.ready();
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 520, 90, 0.9, 0.1, "sawtooth");
    this.noiseSweep(t, 0.8, 4000, 400, 0.12);
  }

  dispose() {
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
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.ctx = c;
  }

  private ready() {
    return this.enabled && this.ctx && this.master ? this.ctx : null;
  }

  private tone(t: number, f0: number, f1: number, dur: number, level: number, type: OscillatorType) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseSweep(t: number, dur: number, f0: number, f1: number, level: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + Math.min(0.05, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur);
  }
}
