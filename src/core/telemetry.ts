// Sự kiện ẩn danh. Chỉ gửi tên sự kiện + vài thuộc tính tổng hợp,
// không bao giờ gửi landmark, khung hình, ảnh hay mask.
// Hiện chỉ log ở môi trường dev; nối Umami/Plausible ở tuần 11.

export type TelemetryEvent =
  | "start_click"
  | "camera_granted"
  | "camera_error"
  | "model_loaded"
  | "first_detection"
  | "session_end";

type Props = Record<string, string | number | boolean>;

export function track(event: TelemetryEvent, props: Props = {}) {
  if (process.env.NODE_ENV !== "production") console.debug("[telemetry]", event, props);
}
