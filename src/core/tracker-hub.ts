// TrackerHub: chỉ khởi tạo những mô hình MediaPipe mà effect khai báo, chạy suy luận
// theo từng khung hình video và giữ kết quả mới nhất để effect đọc trong vòng render.
import type {
  FaceLandmarker,
  FaceLandmarkerResult,
  GestureRecognizer,
  GestureRecognizerResult,
  ImageSegmenter,
  PoseLandmarker,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type TrackerKind = "face" | "hand" | "pose" | "segmentation";
export type Delegate = "GPU" | "CPU";

export type SegmentationMask = { data: Float32Array; width: number; height: number };

export type TrackerResults = {
  face?: FaceLandmarkerResult;
  hand?: GestureRecognizerResult;
  pose?: PoseLandmarkerResult;
  segmentation?: SegmentationMask;
  /** Thời điểm (performance.now) của khung hình đã xử lý gần nhất. */
  timestamp: number;
};

const BASE = "/mediapipe";
const MODEL = {
  face: `${BASE}/models/face_landmarker.task`,
  hand: `${BASE}/models/gesture_recognizer.task`,
  pose: `${BASE}/models/pose_landmarker_lite.task`,
  segmentation: `${BASE}/models/selfie_segmenter.tflite`,
} satisfies Record<TrackerKind, string>;

type Tasks = {
  face?: FaceLandmarker;
  hand?: GestureRecognizer;
  pose?: PoseLandmarker;
  segmentation?: ImageSegmenter;
};

export class TrackerHub {
  results: TrackerResults = { timestamp: 0 };
  /** Thời gian suy luận trung bình động (ms) cho mỗi khung hình. */
  inferenceMs = 0;
  /** Lần cuối có ít nhất một đối tượng được nhận diện (performance.now). */
  lastDetectionAt = 0;
  /** Chạy suy luận mỗi `stride` khung hình; tăng lên khi chất lượng thấp. */
  stride = 1;

  private video: HTMLVideoElement | null = null;
  private running = false;
  private frame = 0;
  private lastTs = -1;
  private segBuffer: Float32Array | null = null;

  private constructor(
    private tasks: Tasks,
    readonly delegate: Delegate,
  ) {}

  static async create(kinds: TrackerKind[], preferred: Delegate = "GPU"): Promise<TrackerHub> {
    try {
      return new TrackerHub(await loadTasks(kinds, preferred), preferred);
    } catch (err) {
      if (preferred === "CPU") throw err;
      console.warn("GPU delegate thất bại, chuyển sang CPU", err);
      return new TrackerHub(await loadTasks(kinds, "CPU"), "CPU");
    }
  }

  start(video: HTMLVideoElement) {
    this.video = video;
    this.running = true;
    this.schedule();
  }

  stop() {
    this.running = false;
    this.video = null;
  }

  close() {
    this.stop();
    Object.values(this.tasks).forEach((t) => t?.close());
    this.tasks = {};
  }

  private schedule() {
    const v = this.video;
    if (!this.running || !v) return;
    if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(() => this.tick());
    else requestAnimationFrame(() => this.tick());
  }

  private tick() {
    const v = this.video;
    if (!this.running || !v) return;
    if (v.readyState >= 2 && this.frame++ % this.stride === 0) this.process(v);
    this.schedule();
  }

  private process(v: HTMLVideoElement) {
    // MediaPipe yêu cầu timestamp tăng nghiêm ngặt.
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;

    const t0 = performance.now();
    const { face, hand, pose, segmentation } = this.tasks;
    const r: TrackerResults = { ...this.results, timestamp: ts };
    let detected = false;

    if (face) {
      r.face = face.detectForVideo(v, ts);
      detected ||= r.face.faceLandmarks.length > 0;
    }
    if (hand) {
      r.hand = hand.recognizeForVideo(v, ts);
      detected ||= r.hand.landmarks.length > 0;
    }
    if (pose) {
      r.pose = pose.detectForVideo(v, ts);
      detected ||= r.pose.landmarks.length > 0;
    }
    if (segmentation) {
      // Mask chỉ hợp lệ trong callback, nên sao chép sang bộ đệm dùng lại.
      segmentation.segmentForVideo(v, ts, (res) => {
        const m = res.confidenceMasks?.[0];
        if (!m) return;
        const src = m.getAsFloat32Array();
        if (this.segBuffer?.length !== src.length) this.segBuffer = new Float32Array(src.length);
        this.segBuffer.set(src);
        r.segmentation = { data: this.segBuffer, width: m.width, height: m.height };
        detected = true;
      });
    }

    this.results = r;
    if (detected) this.lastDetectionAt = ts;
    this.inferenceMs = this.inferenceMs * 0.9 + (performance.now() - t0) * 0.1;
  }
}

async function loadTasks(kinds: TrackerKind[], delegate: Delegate): Promise<Tasks> {
  // Import động để MediaPipe không vào bundle của các trang tĩnh.
  const mp = await import("@mediapipe/tasks-vision");
  const fileset = await mp.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  const base = (kind: TrackerKind) => ({
    baseOptions: { modelAssetPath: MODEL[kind], delegate },
    runningMode: "VIDEO" as const,
  });

  const tasks: Tasks = {};
  try {
    await Promise.all(
      kinds.map(async (kind) => {
        switch (kind) {
          case "face":
            tasks.face = await mp.FaceLandmarker.createFromOptions(fileset, {
              ...base(kind),
              numFaces: 1,
              outputFaceBlendshapes: true,
              outputFacialTransformationMatrixes: true,
            });
            break;
          case "hand":
            tasks.hand = await mp.GestureRecognizer.createFromOptions(fileset, { ...base(kind), numHands: 2 });
            break;
          case "pose":
            tasks.pose = await mp.PoseLandmarker.createFromOptions(fileset, { ...base(kind), numPoses: 1 });
            break;
          case "segmentation":
            tasks.segmentation = await mp.ImageSegmenter.createFromOptions(fileset, {
              ...base(kind),
              outputCategoryMask: false,
              outputConfidenceMasks: true,
            });
            break;
        }
      }),
    );
  } catch (err) {
    Object.values(tasks).forEach((t) => t?.close());
    throw err;
  }
  return tasks;
}
