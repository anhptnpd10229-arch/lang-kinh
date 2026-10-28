// Truy cập camera: kiểm tra hỗ trợ, xin quyền, ánh xạ lỗi sang thông điệp tiếng Việt.
// Không ghi, không gửi khung hình đi đâu — stream chỉ gắn vào <video> cục bộ.

export type SupportReport = {
  secure: boolean;
  media: boolean;
  webgl2: boolean;
  wasm: boolean;
  inAppBrowser: boolean;
};

export function checkSupport(): SupportReport {
  const canvas = document.createElement("canvas");
  return {
    secure: window.isSecureContext,
    media: !!navigator.mediaDevices?.getUserMedia,
    webgl2: !!canvas.getContext("webgl2"),
    wasm: typeof WebAssembly === "object",
    // Webview của Zalo/Facebook/Instagram/TikTok/Line thường chặn camera.
    inAppBrowser: /FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|musical_ly|BytedanceWebview/i.test(navigator.userAgent),
  };
}

export type Facing = "user" | "environment";

export type CameraOptions = { facing: Facing; height: 480 | 720 };

export async function openCamera({ facing, height }: CameraOptions): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: facing,
      height: { ideal: height },
      width: { ideal: Math.round((height * 4) / 3) },
    },
  });
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export type CameraErrorKind = "denied" | "notfound" | "busy" | "constraints" | "insecure" | "unknown";

export function classifyCameraError(err: unknown): CameraErrorKind {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "notfound";
    case "NotReadableError":
    case "TrackStartError":
      return "busy";
    case "OverconstrainedError":
      return "constraints";
    case "SecurityError":
      return "insecure";
    default:
      return "unknown";
  }
}

export const CAMERA_ERROR_TEXT: Record<CameraErrorKind, string> = {
  denied:
    "Bạn đã từ chối quyền camera. Hãy bật lại trong phần cài đặt trang của trình duyệt (biểu tượng ổ khoá cạnh địa chỉ) rồi thử lại.",
  notfound: "Không tìm thấy camera trên thiết bị này.",
  busy: "Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.",
  constraints: "Camera không hỗ trợ cấu hình yêu cầu. Thử lại với chất lượng thấp hơn.",
  insecure: "Trình duyệt chặn camera vì trang không chạy qua HTTPS.",
  unknown: "Không mở được camera. Hãy tải lại trang và thử lại.",
};
