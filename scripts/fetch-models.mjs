// Tự host MediaPipe: chép WASM từ node_modules và tải các mô hình .task về public/mediapipe/.
// Bỏ qua tệp đã có, nên chạy lại nhiều lần không tốn băng thông.
import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "mediapipe");

const MODELS = {
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "gesture_recognizer.task":
    "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
  "pose_landmarker_lite.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  "selfie_segmenter.tflite":
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
};

const exists = (p) => stat(p).then(() => true, () => false);

await mkdir(join(out, "models"), { recursive: true });
await cp(join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm"), join(out, "wasm"), { recursive: true });

for (const [file, url] of Object.entries(MODELS)) {
  const dest = join(out, "models", file);
  if (await exists(dest)) continue;
  process.stdout.write(`Đang tải ${file}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải ${url} thất bại: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log("xong");
}
