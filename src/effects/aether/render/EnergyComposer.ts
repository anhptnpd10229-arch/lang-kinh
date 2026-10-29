// Hậu kỳ: chỉ hiệu ứng năng lượng được bloom, video camera thì không (tránh làm loá cả khung hình).
// 1) Render cảnh hiệu ứng lên nền đen vào render target half-float (giữ được giá trị > 1).
// 2) UnrealBloomPass cộng quầng sáng vào chính render target đó.
// 3) Một quad toàn màn hình ghép: video (lật gương, chỉnh màu nhẹ, vignette) + hiệu ứng (blend kiểu screen),
//    cộng ánh sáng màn hình khi nạp và chớp sáng khi giải phóng.
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Video được xử lý thẳng trên giá trị sRGB (NoColorSpace); hiệu ứng ở dạng tuyến tính nên được nén mềm rồi đổi sang sRGB trước khi ghép.
const FRAGMENT = /* glsl */ `
  uniform sampler2D tVideo;
  uniform sampler2D tFx;
  uniform float uFlash;
  uniform float uGlow;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec3 video = texture2D(tVideo, vec2(1.0 - vUv.x, vUv.y)).rgb;
    float l = dot(video, vec3(0.299, 0.587, 0.114));
    video = mix(vec3(l), video, 0.82);
    video = (video - 0.5) * 1.06 + 0.47;
    video *= vec3(0.93, 0.98, 1.06);
    vec2 q = vUv - 0.5;
    video *= 1.0 - dot(q, q) * 0.9;

    vec3 fx = max(texture2D(tFx, vUv).rgb, 0.0);
    fx = 1.0 - exp(-fx * 0.95);
    fx = pow(fx, vec3(1.0 / 2.2));
    vec3 col = 1.0 - (1.0 - clamp(video, 0.0, 1.0)) * (1.0 - fx);

    col += vec3(0.2, 0.6, 1.0) * uGlow * (0.25 + dot(q, q) * 1.6);
    col = mix(col, vec3(0.86, 0.97, 1.0), uFlash);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class EnergyComposer {
  readonly uniforms = {
    tVideo: { value: null as THREE.Texture | null },
    tFx: { value: null as THREE.Texture | null },
    uFlash: { value: 0 },
    uGlow: { value: 0 },
    uTime: { value: 0 },
  };
  private target: THREE.WebGLRenderTarget;
  private bloom: UnrealBloomPass;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private videoTex: THREE.VideoTexture;
  private size = new THREE.Vector2();
  private buf = new THREE.Vector2();
  private scale = 1;

  constructor(video: HTMLVideoElement) {
    this.videoTex = new THREE.VideoTexture(video);
    this.videoTex.colorSpace = THREE.NoColorSpace;
    // Half-float để lõi sáng > 1 không bị cắt trước khi bloom (three hiện chỉ chạy WebGL2, nơi định dạng này được hỗ trợ).
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    // Bloom tiết chế: chỉ những phần thật sáng (lõi, tia sét) mới toả, bán kính vừa phải.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.4, 0.3);
    this.uniforms.tVideo.value = this.videoTex;
    this.uniforms.tFx.value = this.target.texture;
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: this.uniforms, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** `scale`: tỉ lệ độ phân giải của lớp hiệu ứng so với canvas (giảm trên máy yếu). */
  setScale(scale: number) {
    this.scale = scale;
    this.size.set(0, 0);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, dt: number) {
    const buf = renderer.getDrawingBufferSize(this.buf);
    const w = Math.max(1, Math.round(buf.x * this.scale));
    const h = Math.max(1, Math.round(buf.y * this.scale));
    if (w !== this.size.x || h !== this.size.y) {
      this.size.set(w, h);
      this.target.setSize(w, h);
      // Bloom chạy ở nửa độ phân giải: đủ mềm, đỡ tốn GPU.
      this.bloom.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    }

    const prevBg = scene.background;
    scene.background = null;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    this.bloom.render(renderer, this.target, this.target, dt, false);
    scene.background = prevBg;

    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() {
    this.target.dispose();
    this.bloom.dispose();
    this.videoTex.dispose();
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
  }
}
