# Kế hoạch: Nền tảng nghệ thuật tương tác camera WebAR (tên tạm: **"Lăng Kính"**)

## Context
Bạn muốn xây một website cho phép mở camera ngay trên trình duyệt để trải nghiệm hiệu ứng nghệ thuật kỹ thuật số (face/hand/pose tracking, vật thể 3D, shader), **lấy cảm hứng về tinh thần thử nghiệm và bố cục portfolio** từ Unknown Reality Studio nhưng **không sao chép** mã nguồn, tài sản hay nhận diện thương hiệu. Thư mục `D:\laptrinh\VISUAL\WebAR` hiện trống, nên đây là dự án làm từ đầu. Mục tiêu: **có demo chạy được sớm (cuối tuần 2)**, ra mắt MVP với 5 hiệu ứng, dễ bảo trì và chi phí vận hành thấp.

> **Quy ước:** mọi con số thời gian/chi phí bên dưới là **ước tính có giả định**, ghi dạng khoảng. Cần kiểm chứng lại bằng prototype (tuần 1–2) và báo giá thực tế.

---

## 1. Tóm tắt dự án

| Mục | Nội dung |
|---|---|
| Sản phẩm | Web gallery các "tác phẩm camera" chạy realtime trên thiết bị, không cần cài app |
| Người dùng chính | (1) Gen Z/millennial thích nội dung thị giác, chia sẻ mạng xã hội; (2) người làm sáng tạo/designer/VJ tìm cảm hứng; (3) thương hiệu/agency tìm đối tác activation (khách hàng tiềm năng về sau) |
| Vấn đề giải quyết | Filter AR hiện bị khoá trong app (Instagram/TikTok/Snap), phải cài đặt, mang tính thương mại hoá; thiếu nơi trải nghiệm **nghệ thuật camera thử nghiệm**, mở bằng 1 link |
| Nguyên tắc | Xử lý **100% trên thiết bị**, không upload video; mỗi tác phẩm = 1 URL chia sẻ được; tải nhanh, chạy được trên điện thoại tầm trung |
| Lợi thế cạnh tranh | Không cần app; link chia sẻ trực tiếp; định vị "nghệ thuật" thay vì "filter làm đẹp"; quyền riêng tư rõ ràng; kiến trúc effect-as-module cho phép ra tác phẩm mới nhanh |

### Bối cảnh nền tảng (Giai đoạn 1 – cần xác minh trong tuần 1)
| Nhóm | Ví dụ | Ghi chú |
|---|---|---|
| Filter trong app | Meta Spark (đã ngừng 2025), Snap Lens Studio, TikTok Effect House | Mạnh nhưng phải cài app, phụ thuộc nền tảng |
| WebAR thương mại | 8th Wall (Niantic — đã thông báo dừng dịch vụ, cần xác minh tình trạng hiện tại), Zappar, Banuba Web | Có SLAM/face, phí license cao |
| Mã nguồn mở | MediaPipe Tasks Vision, MindAR, AR.js, WebXR (Chrome Android) | Miễn phí, tự chịu tối ưu |
| Interactive art web | Các studio/portfolio WebGL, Shadertoy, Chrome Experiments | Nguồn cảm hứng về hình thức |

**Khả thi kỹ thuật:** face/hand/pose/segmentation realtime trên web là khả thi với MediaPipe Tasks Vision (WASM + WebGL). Thứ **không** khả thi rẻ trên mọi trình duyệt: neo vật thể vào mặt phẳng thế giới thực (SLAM) — WebXR chỉ ổn trên Chrome Android, iOS Safari chưa hỗ trợ `immersive-ar`. ⇒ MVP dùng "AR theo cơ thể" (face/hand/pose/segmentation), không dùng SLAM.

---

## 2. Phạm vi sản phẩm & MVP

| Tính năng | MVP | Sau MVP |
|---|---|---|
| Trang chủ giới thiệu + tác phẩm nổi bật | ✅ | Video showreel |
| Thư viện hiệu ứng (lưới, lọc theo loại) | ✅ | Tìm kiếm, sắp xếp theo độ phổ biến |
| Trang trải nghiệm trực tiếp (camera) | ✅ | Chế độ toàn màn hình kiosk/triển lãm |
| Phân loại: Face / Hand / Body / World / Signature | ✅ (tag tĩnh) | Tag theo cảm xúc, nghệ sĩ |
| Trang thông tin tác phẩm (mô tả, cách tương tác, credit) | ✅ | Bài viết making-of |
| Chia sẻ qua link + ảnh OG riêng | ✅ | Link kèm tham số (màu, seed) |
| Chụp ảnh khoảnh khắc (lưu **trên máy**, Web Share API) | ✅ | Quay video ngắn (MediaRecorder) |
| Trang Giới thiệu / Quyền riêng tư | ✅ | |
| Admin CMS | ❌ (metadata trong repo) | Headless CMS khi >15 tác phẩm hoặc có người không code cần đăng bài |
| Tài khoản người dùng, bộ sưu tập yêu thích | ❌ | Có thể |
| Nghệ sĩ khách gửi tác phẩm (SDK) | ❌ | Giai đoạn 3–6 tháng |
| Đa ngôn ngữ VI/EN | EN hoặc VI một ngôn ngữ | Cả hai |

---

## 3. Phân tích công nghệ (Giai đoạn 4)

| Hạng mục | Lựa chọn | Phương án thay thế | Lý do chọn |
|---|---|---|---|
| Framework | **Next.js (App Router) + TypeScript**, xuất tĩnh (SSG) | Vite + React SPA; Astro | Cần SEO + metadata/OG riêng cho từng link tác phẩm khi chia sẻ; trang camera vẫn chạy client-only qua dynamic import |
| Camera | **MediaDevices.getUserMedia** (không cần WebRTC peer) | — | WebRTC chỉ cần khi truyền video giữa người dùng; ở đây không cần |
| Nhận diện | **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`): FaceLandmarker, HandLandmarker/GestureRecognizer, PoseLandmarker, ImageSegmenter | TensorFlow.js models; Human.js | Một thư viện cho cả 4 loại, có GPU delegate, có ma trận biến đổi khuôn mặt + blendshapes |
| 3D | **Three.js qua React Three Fiber + drei** | Three.js thuần | Ghép tốt với React, `useFrame` cho vòng lặp; vẫn dùng được Three.js thuần bên trong |
| Shader | **GLSL qua ShaderMaterial / postprocessing** | WebGPU (theo dõi sau) | WebGL2 phổ biến trên thiết bị mục tiêu; WebGPU chưa đủ phổ biến trên iOS |
| Nội dung | **MDX/JSON trong repo** (`content/effects/*.mdx`) | Sanity / Payload / Supabase | 0 đồng, version cùng code; chuyển sang CMS sau |
| Backend/DB | **Không có trong MVP** | Supabase khi cần tài khoản/CMS | Ít thứ phải vận hành nhất |
| Lưu trữ tài nguyên | Model `.task`/WASM + GLB (Draco/meshopt) + KTX2 tự host, qua CDN | Cloudflare R2 khi dung lượng lớn | Không phụ thuộc CDN bên thứ ba, cache được |
| Hosting/CDN | **Cloudflare Pages** (gói free cho phép thương mại) | Vercel (gói Hobby không cho dùng thương mại) | Chi phí ~0, CDN toàn cầu, HTTPS mặc định (bắt buộc cho camera) |
| Analytics | **Umami tự host** hoặc **Plausible** | GA4 | Không cookie, không định danh cá nhân, có custom event |
| Giám sát lỗi | **Sentry** (gói free/dev) | Highlight, GlitchTip | Bắt lỗi WebGL/WASM theo thiết bị |
| Hiệu năng | Web Vitals + event FPS tự đo | — | Đo cả tải trang và FPS thời gian thực |

### Kết nối các thành phần
```
Trình duyệt
 ├─ Next.js pages (SSG): Home / Gallery / Effect detail  ──► HTML tĩnh trên Cloudflare CDN
 └─ /play/[slug] (client-only)
      ├─ CameraManager ── getUserMedia ──► <video> (không rời khỏi máy)
      ├─ TrackerHub ── MediaPipe Tasks (WASM+GPU) ──► landmarks/mask mỗi frame
      ├─ EffectRuntime ── nạp module effect theo slug (dynamic import)
      │      └─ R3F Canvas + shader: video làm texture nền + lớp 3D/hiệu ứng
      ├─ PerfMonitor ── đo FPS, tự hạ chất lượng
      └─ Telemetry ── sự kiện ẩn danh ──► Umami/Plausible; lỗi ──► Sentry
Tài nguyên tĩnh (model .task, wasm, glb, ktx2) ──► CDN, cache dài hạn
```

---

## 4. Kiến trúc hệ thống

### Hợp đồng module hiệu ứng (lõi để bảo trì & mở rộng)
Mỗi tác phẩm là một thư mục `src/effects/<slug>/` gồm:
- `meta.ts` — slug, tên, tag, trackers cần dùng (`['face']`, `['hand','segmentation']`…), mức tải (nhẹ/vừa/nặng), hướng dẫn tương tác.
- `Effect.tsx` — component R3F nhận `{ video, results, quality, time }`.
- `assets/` — GLB/texture riêng.

`TrackerHub` chỉ khởi tạo model mà effect khai báo ⇒ effect face không tải model pose. Thêm tác phẩm mới = thêm một thư mục, không sửa lõi.

### Cấu trúc thư mục dự kiến
```
app/                 (routes: /, /works, /works/[slug], /play/[slug], /about, /privacy)
src/core/            (camera, tracker-hub, effect-runtime, perf-monitor, telemetry)
src/effects/<slug>/  (từng tác phẩm)
src/ui/              (component giao diện, trạng thái quyền/lỗi)
content/effects/     (MDX mô tả tác phẩm)
public/models/       (mediapipe .task + wasm tự host)
```

### Chiến lược chất lượng thích ứng
3 mức `high / medium / low` (độ phân giải camera 720p→480p, số hạt, postprocessing bật/tắt, tần suất chạy model mỗi frame hoặc cách frame). Tự hạ mức khi FPS trung bình 2 giây < 24.

---

## 5. Sơ đồ luồng người dùng

```
[Link chia sẻ / Mạng xã hội / Tìm kiếm]
            │
     ┌──────┴──────┐
     ▼             ▼
 Trang chủ ──► Thư viện (lọc tag) ──► Trang tác phẩm
                                          │  (xem preview video, hướng dẫn)
                                          ▼
                                  Nút "Bắt đầu trải nghiệm"
                                          │
                       Kiểm tra hỗ trợ (HTTPS, getUserMedia, WebGL2)
                         │ không hỗ trợ ──► Màn "Thiết bị chưa hỗ trợ" + video preview + gợi ý trình duyệt
                         ▼
                  Màn giải thích quyền riêng tư (1 dòng) ──► Xin quyền camera
                         │ từ chối ──► Màn hướng dẫn bật lại quyền theo trình duyệt + nút thử lại
                         ▼
                  Đang tải model + tài nguyên (thanh tiến trình, % thật)
                         │ lỗi tải ──► Thử lại / hạ chất lượng
                         ▼
                  Trải nghiệm: chỉ báo "Camera đang bật" luôn hiển thị
                  Gợi ý tương tác (ẩn sau 5s) · Nút: chụp · đổi camera trước/sau · chất lượng · thoát
                         │ không thấy mặt/tay > 3s ──► Gợi ý "Đưa tay vào khung hình"
                         ▼
                  Chụp ảnh ──► Xem trước ──► Lưu máy / Web Share / Copy link
                         ▼
                  Thoát (tắt hẳn camera track) ──► Gợi ý tác phẩm tiếp theo
```

### Cấu trúc từng trang (Giai đoạn 3)
| Trang | Bố cục |
|---|---|
| Trang chủ | Hero typography rất lớn + 1 tác phẩm nổi bật dạng video loop; lưới 6–9 tác phẩm (ô kích thước không đều kiểu portfolio); đoạn tuyên ngôn ngắn; footer quyền riêng tư |
| Thư viện | Thanh lọc tag dạng chip; lưới thẻ: video preview tự phát khi hover/khi lọt vào màn hình (mobile), tên, tag, nhãn "nặng/nhẹ" |
| Trang tác phẩm | Video preview lớn, tiêu đề, mô tả nghệ thuật, "Cách tương tác" (icon cử chỉ), yêu cầu thiết bị, nút CTA lớn, credit, tác phẩm liên quan |
| Trải nghiệm | Toàn màn hình, video gương (camera trước), UI tối thiểu ở cạnh dưới, chấm đỏ "camera đang bật", hướng dẫn chồng mờ |
| Giới thiệu / Riêng tư | Văn bản, cam kết "không ghi, không gửi hình ảnh" |

**Ngôn ngữ thiết kế:** nền đen/xám đậm hoặc trắng ngà, 1 màu nhấn; font display lớn (vd: một grotesk hoặc monospace có cá tính — chọn font có license web), font body dễ đọc; chuyển động bằng CSS/Framer Motion: fade + dịch nhẹ, chuyển trang mượt, tôn trọng `prefers-reduced-motion`. Thiết kế **mobile-first** vì phần lớn lượt mở link chia sẻ đến từ điện thoại (giả định — kiểm chứng bằng analytics).

---

## 6. Danh sách tính năng & ưu tiên

| # | Tính năng | Ưu tiên | Ghi chú |
|---|---|---|---|
| 1 | CameraManager + xử lý quyền/lỗi | P0 | Nền tảng của mọi thứ |
| 2 | TrackerHub (face/hand/pose/seg, nạp theo nhu cầu) | P0 | |
| 3 | EffectRuntime + hợp đồng module | P0 | |
| 4 | 5 hiệu ứng mẫu | P0 | Xem mục 7 |
| 5 | Trang tác phẩm + link chia sẻ + OG image | P0 | |
| 6 | Thư viện + tag | P0 | |
| 7 | PerfMonitor + chất lượng thích ứng | P0 | Bắt buộc cho mobile |
| 8 | Chụp ảnh + Web Share | P1 | |
| 9 | Analytics ẩn danh + Sentry | P1 | Cần có trước ngày ra mắt |
| 10 | Trang chủ dạng portfolio + chuyển động | P1 | |
| 11 | Quay video ngắn | P2 | MediaRecorder, hỗ trợ iOS hạn chế |
| 12 | CMS/Admin | P3 | |
| 13 | WebXR world-AR (Android) | P3 | |

---

## 7. Kế hoạch phát triển hiệu ứng (Giai đoạn 5)

| # | Tên (tạm) | Cơ chế | Công nghệ | Độ khó | Thời gian (1 dev) | Tiêu chí hoàn thành |
|---|---|---|---|---|---|---|
| 1 | **"Mặt Nạ Tinh Thể"** – vật thể 3D bám mặt | FaceLandmarker trả ma trận biến đổi khuôn mặt → gắn GLB (mặt nạ/vương miện) vào; lưới mặt vô hình làm occluder để vật thể "ra sau đầu" đúng; blendshape (há miệng, nháy mắt) kích hoạt hiệu ứng | FaceLandmarker + R3F + GLB | Trung bình | 1–1.5 tuần | Bám mặt ổn định khi xoay ±45°, không rung rõ (có lọc One-Euro), ≥30 FPS trên máy mục tiêu, hoạt động với 1 mặt |
| 2 | **"Bàn Tay Hạt"** – phản ứng cử chỉ | GestureRecognizer: nắm tay = hút hạt, xoè tay = nổ tung, chụm ngón (pinch, tính khoảng cách ngón cái–trỏ) = vẽ vệt sáng; 10–30k hạt trên GPU | GestureRecognizer/HandLandmarker + shader điểm (GPGPU hoặc InstancedMesh) | Trung bình | 1–1.5 tuần | Nhận ≥3 cử chỉ, độ trễ cảm nhận < 150 ms, 2 tay đồng thời, tự giảm số hạt ở mức low |
| 3 | **"Khách Lạ"** – vật thể ảo trong khung hình | Sinh vật/khối 3D trôi trong không gian camera; ImageSegmenter tạo mặt nạ người → vật thể va chạm/né dáng người, núp sau người (che khuất theo mask) | ImageSegmenter + R3F + vật lý nhẹ (tự viết hoặc rapier) | Trung bình–Khó | 1.5–2 tuần | Vật thể bị người che đúng, va chạm với bóng người nhìn thấy được, không cần SLAM |
| 4 | **"Dòng Chảy Cơ Thể"** – đồ hoạ theo chuyển động | PoseLandmarker lấy 33 điểm; vận tốc khớp → trường dòng chảy (flow field) làm méo/vệt màu trên video; chuyển động mạnh = màu rực, đứng yên = tan biến | PoseLandmarker + fragment shader + ping-pong framebuffer | Khó | 1.5–2 tuần | Đáp ứng rõ khi vẫy tay/nhảy, đứng yên thì nhạt dần, ≥24 FPS mức medium |
| 5 | **"Dư Ảnh"** – tác phẩm chủ lực (signature) | Bộ đệm vòng N frame video gần nhất; mỗi hàng/vùng ảnh hiển thị một thời điểm quá khứ khác nhau (slit-scan theo thời gian); vị trí và độ mở bàn tay điều khiển "lát cắt thời gian"; segmentation giữ người ở hiện tại còn nền trôi về quá khứ (hoặc ngược lại) | 2DArray texture/atlas trên GPU + HandLandmarker + ImageSegmenter + shader | Khó | 2–3 tuần | Hiệu ứng mượt, cảm giác "bất ngờ" khi thử nghiệm nội bộ (≥4/5 người test muốn chia sẻ), quản lý bộ nhớ ổn định không rò rỉ sau 5 phút |

Thứ tự làm: 1 → 2 → 4 → 3 → 5 (dễ trước, signature cuối để kế thừa hạ tầng). Hiệu ứng 1 là **demo sớm** cuối tuần 2.

---

## 8. Kế hoạch phát triển theo tuần

### Phương án A – 1 người (full-stack + creative coder), ~12–14 tuần
| Tuần | Mục tiêu | Đầu việc | Bàn giao | Phụ thuộc | Rủi ro → xử lý |
|---|---|---|---|---|---|
| 1 | Nghiên cứu & spike | Test MediaPipe face/hand/pose trên 3–5 máy thật (iPhone, Android tầm trung, laptop); đo FPS; moodboard | Báo cáo khả thi + bảng FPS | Thiết bị test | iOS GPU delegate lỗi → thử CPU delegate, giảm độ phân giải |
| 2 | Lõi + demo đầu | Scaffold Next.js, CameraManager, TrackerHub, EffectRuntime, Effect 1 bản thô; deploy Cloudflare | **Demo link chạy được** | Tuần 1 | HTTPS local → dùng `next dev --experimental-https` hoặc tunnel |
| 3 | Trạng thái & UX camera | Màn xin quyền, từ chối, không hỗ trợ, đang tải; PerfMonitor | Luồng camera hoàn chỉnh | Tuần 2 | Khác biệt trình duyệt → bảng test thủ công |
| 4 | Effect 1 hoàn thiện | Occlusion, lọc rung, blendshape, asset GLB | Effect 1 đạt tiêu chí | Asset 3D | Asset chậm → dùng khối hình học procedural |
| 5 | Effect 2 | Gesture + hạt | Effect 2 | | Nhận cử chỉ sai → ngưỡng + debounce |
| 6–7 | Effect 4 + 3 | Pose flow-field, segmentation + vật thể | Effect 3, 4 | | FPS thấp khi chạy 2 model → chạy xen kẽ frame |
| 8 | Thiết kế UI | Design system, Home, Gallery, trang tác phẩm | UI hoàn chỉnh | Nội dung | |
| 9–10 | Effect 5 signature | Ring buffer, shader, tinh chỉnh nghệ thuật | Effect 5 | Lõi ổn định | Tràn bộ nhớ GPU mobile → giảm N frame, độ phân giải |
| 11 | Chia sẻ & đo lường | OG image, chụp ảnh, Web Share, Umami, Sentry | Bản RC | | |
| 12 | QA & tối ưu | Ma trận thiết bị, Lighthouse, giảm bundle, nén asset | Báo cáo QA | | Lỗi máy cụ thể → fallback "low" |
| 13–14 | Đệm & ra mắt | Sửa lỗi, nội dung, beta 20–50 người, launch | **MVP live** | | Trễ tiến độ → cắt Effect 3 sang sau MVP |

### Phương án B – nhóm 4 người, ~7–8 tuần
Vai trò: **PM/Creative Lead** (kiêm nội dung, QA), **Frontend/Platform Dev**, **Creative Technologist** (shader/3D/effect), **UI/UX + 3D Artist** (bán thời gian hoặc 2 người tách). Nhóm 5 người: thêm 1 creative technologist thứ hai để làm song song effect.

| Tuần | PM/Creative Lead | Frontend/Platform | Creative Technologist | UI/UX + 3D |
|---|---|---|---|---|
| 1 | Nghiên cứu người dùng, định vị, ma trận thiết bị | Scaffold, CI, deploy | Spike MediaPipe, đo FPS | Moodboard, typography |
| 2 | Concept 5 tác phẩm | Camera/Tracker/Runtime | Effect 1 thô → **demo** | Wireframe các trang |
| 3 | Viết nội dung tác phẩm | Trạng thái camera, PerfMonitor | Effect 1 hoàn thiện, Effect 2 | Hi-fi Home/Gallery, asset GLB Effect 1 |
| 4 | Test người dùng vòng 1 | Gallery, trang tác phẩm, MDX | Effect 2 + 4 | Hi-fi trải nghiệm, asset Effect 3 |
| 5 | Kế hoạch launch | Chia sẻ, OG, chụp ảnh | Effect 3 + bắt đầu 5 | Motion, preview video |
| 6 | Test vòng 2 | Analytics, Sentry, tối ưu bundle | Effect 5 | Polish UI |
| 7 | QA ma trận thiết bị | Sửa lỗi | Tối ưu FPS | Asset marketing |
| 8 | **Ra mắt** | Giám sát | Hotfix | Nội dung mạng xã hội |

Phụ thuộc chính: Runtime (Frontend) phải xong cuối tuần 2 để Creative Technologist cắm effect vào; asset 3D trễ hơn effect 1 tuần → dùng placeholder.

---

## 9. Phân công nhân sự

| Vai trò | Trách nhiệm | Kỹ năng bắt buộc |
|---|---|---|
| PM / Creative Lead | Phạm vi, ưu tiên, concept nghệ thuật, nội dung, test người dùng, KPI | Quản lý sản phẩm, gu thị giác |
| Frontend / Platform Dev | Next.js, lõi camera/tracker/runtime, hiệu năng, deploy, analytics | React/TS, Web APIs, tối ưu bundle |
| Creative Technologist | Effect, shader GLSL, R3F, tối ưu GPU | Three.js, GLSL, toán đồ hoạ |
| UI/UX Designer | Design system, wireframe, motion, trạng thái lỗi | Figma, motion, mobile-first |
| 3D Artist (bán thời gian/thuê ngoài) | GLB tối ưu (< 2 MB/asset), texture KTX2 | Blender, low-poly, PBR |

---

## 10. Ngân sách dự kiến (Giai đoạn 7)

**Giả định:** nhân sự tại Việt Nam, đơn giá freelance/hợp đồng tham khảo thị trường 2025–2026 (**cần báo giá thực**); 1 USD ≈ 25.000–26.500 VND; chưa gồm VAT/thuế TNCN; chi phí hạ tầng theo bảng giá công khai, có thể thay đổi.

| Hạng mục | Thử nghiệm ngân sách thấp | MVP chuyên nghiệp | Mở rộng quy mô (năm 1) |
|---|---|---|---|
| Nhân sự | 1 người tự làm/side-project: 0 – 150 triệu (3 tháng nếu trả lương 1 dev) | Nhóm 4 người × 2 tháng: ~250 – 600 triệu | Nhóm 5–7 người duy trì + phát triển: ~1,5 – 3,5 tỷ/năm |
| Thiết kế UI/UX | Tự làm / template: 0 – 15 triệu | 40 – 120 triệu | Gộp trong nhân sự |
| Tài nguyên 3D | Asset CC0 (Poly Haven, Kenney…) + procedural: 0 – 5 triệu | 5–10 asset thuê ngoài: 20 – 80 triệu | 50 – 200 triệu |
| Font | Google Fonts: 0 | Font thương mại: 0 – 20 triệu | 0 – 30 triệu |
| Hosting/CDN | Cloudflare Pages free: 0 | 0 – 0,5 triệu/tháng | R2 + Workers: 1 – 10 triệu/tháng tuỳ lưu lượng |
| Tên miền | ~0,3 – 1 triệu/năm | như trái | như trái |
| Analytics | Umami tự host trên free tier: 0 | Plausible ~0,25 – 0,5 triệu/tháng | 1 – 3 triệu/tháng |
| Giám sát lỗi | Sentry free: 0 | Sentry Team: ~0,7 triệu/tháng | 1 – 5 triệu/tháng |
| Thiết bị test | Mượn máy / BrowserStack trial | Mua 2–3 Android tầm trung: 10 – 25 triệu; BrowserStack 1–1,5 triệu/tháng | 30 – 60 triệu |
| Bảo trì (sau MVP) | Tự làm | 15–20% chi phí phát triển/năm | Gộp trong nhân sự |
| **Tổng (khoảng)** | **~0 – 200 triệu** | **~350 – 900 triệu** | **~2 – 4,5 tỷ/năm** |

**Phát sinh có thể có:** chi phí marketing/KOL, pháp lý (điều khoản, chính sách riêng tư), CMS trả phí nếu vượt free tier, bản quyền âm thanh nếu thêm nhạc, thuê activation tại triển lãm (màn hình, máy tính).

---

## 11. Bảo mật & hiệu suất (Giai đoạn 8)

| Yêu cầu | Giải pháp |
|---|---|
| Chỉ xin quyền khi người dùng chủ động | `getUserMedia` chỉ gọi trong handler của nút "Bắt đầu"; không tự bật khi vào trang |
| Xử lý trên thiết bị | Toàn bộ inference bằng MediaPipe WASM trong trình duyệt; model tự host |
| Không ghi/tải video | Không có endpoint upload; ảnh chụp chỉ tạo Blob cục bộ; CSP `connect-src` giới hạn về analytics/Sentry; Sentry tắt replay/screenshot |
| Thông báo camera đang bật | Chấm đỏ + chữ "Camera đang bật" luôn hiện; khi thoát/ẩn tab (`visibilitychange`) gọi `track.stop()` |
| Tối ưu tải | Model nạp theo effect; GLB nén Draco/meshopt; texture KTX2; preload model khi người dùng ở trang tác phẩm (sau khi trang đã tải xong); cache dài hạn bằng hash |
| FPS & bộ nhớ | Chạy model ở 480p dù hiển thị cao hơn; dùng `requestVideoFrameCallback`; bỏ frame khi model chưa xong; dispose texture/geometry khi thoát; chất lượng thích ứng; về sau chuyển inference sang Web Worker + OffscreenCanvas |
| Trình duyệt không hỗ trợ | Phát hiện tính năng (không dựa vào UA): `navigator.mediaDevices`, WebGL2, WASM; fallback video preview |
| Từ chối quyền | Phân biệt `NotAllowedError`, `NotFoundError`, `NotReadableError` (camera bị app khác dùng), `OverconstrainedError`; hướng dẫn riêng cho iOS Safari / Chrome Android / desktop |
| Trình duyệt trong app (Zalo, Facebook, Instagram webview) | Phát hiện và hiện nút "Mở bằng trình duyệt" vì webview thường chặn camera — **đây là rủi ro lớn khi chia sẻ link qua mạng xã hội** |

Mục tiêu hiệu năng (giả định, chốt sau spike tuần 1): JS ban đầu trang chủ < 150 KB gzip; tài nguyên một effect < 8 MB; thời gian từ bấm nút đến frame đầu có hiệu ứng < 5 s trên 4G; ≥ 30 FPS máy tầm cao, ≥ 24 FPS máy tầm trung.

---

## 12. Rủi ro & phương án giảm thiểu

| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| FPS thấp trên Android tầm trung | Cao | Cao | Spike tuần 1, chất lượng thích ứng, chạy model cách frame |
| iOS Safari: lỗi GPU delegate / giới hạn bộ nhớ WebGL | Trung bình | Cao | Fallback CPU, giảm texture, test sớm trên iPhone thật |
| Webview mạng xã hội chặn camera | Cao | Cao | Phát hiện webview + hướng dẫn mở trình duyệt; trang tác phẩm vẫn có giá trị nhờ video preview |
| Model nặng làm chậm lần tải đầu | Trung bình | Trung bình | Chỉ nạp model cần, preload sau tương tác, CDN cache |
| Tracking kém trong thiếu sáng | Trung bình | Trung bình | Gợi ý "tăng ánh sáng" khi độ tin cậy thấp kéo dài |
| Effect signature không đủ "bất ngờ" | Trung bình | Cao | 2 prototype nhanh tuần 2–3, test người dùng trước khi đầu tư |
| Bị cho là sao chép nguồn cảm hứng | Thấp | Cao | Nhận diện, tên, concept, asset tự tạo; không lấy mã/ảnh/font của site tham khảo; ghi credit "inspired by" nếu muốn |
| Thư viện thay đổi API (MediaPipe) | Thấp | Trung bình | Khoá phiên bản, bọc trong TrackerHub |
| 1 người làm bị quá tải | Cao (PA A) | Cao | Cắt Effect 3 khỏi MVP nếu trễ quá 2 tuần |

---

## 13. KPI & tiêu chí nghiệm thu (Giai đoạn 9)

| KPI | Định nghĩa đo | Mục tiêu MVP (giả định ban đầu) |
|---|---|---|
| Tỷ lệ bắt đầu camera | `camera_granted` / lượt xem trang tác phẩm | ≥ 35% |
| Tỷ lệ trải nghiệm thành công | phiên có `first_detection` trong 10 s / `camera_granted` | ≥ 85% |
| Thời gian tải effect | bấm "Bắt đầu" → `first_frame_rendered`, p75 | < 5 s (4G) |
| FPS trung bình | trung vị FPS theo nhóm thiết bị (desktop / iOS / Android), gửi theo **khoảng** (<15, 15–24, 24–30, >30) | ≥ 24 trên mobile mục tiêu |
| Thời lượng trải nghiệm | thời gian camera bật, trung vị | ≥ 45 s |
| Tỷ lệ chia sẻ | (`share_click` + `photo_saved`) / phiên thành công | ≥ 10% |
| Lỗi | phiên có lỗi JS/WebGL nghiêm trọng (Sentry) | < 3% |
| Chi phí vận hành | tổng chi phí hạ tầng / 1.000 phiên | gần 0 ở mức < 50k phiên/tháng |

**Đo lường không xâm phạm riêng tư:** chỉ gửi sự kiện đếm + số liệu tổng hợp (slug, nhóm thiết bị, khoảng FPS, thời lượng làm tròn); **không** gửi landmark, frame, ảnh, mask; không cookie; không lưu IP đầy đủ (Umami/Plausible đã hash/ẩn danh); Sentry tắt session replay, lọc breadcrumb chứa dữ liệu ảnh.

**Tiêu chí nghiệm thu MVP:** 5 effect đạt tiêu chí mục 7; chạy trên ma trận: iPhone (iOS 16+) Safari, Android tầm trung Chrome, Chrome/Edge/Safari desktop; mọi trạng thái lỗi trong luồng mục 5 có màn hình riêng; Lighthouse Performance ≥ 85 cho Home/Gallery trên mobile; không có request mạng nào chứa dữ liệu hình ảnh (kiểm tra bằng DevTools Network).

---

## 14. Phát triển 3–6 tháng tiếp theo

| Thời gian | Hướng phát triển |
|---|---|
| Tháng 1–2 sau MVP | 1 tác phẩm mới mỗi 2 tuần dựa trên dữ liệu KPI; quay video ngắn; song ngữ VI/EN; Web Worker cho inference |
| Tháng 2–4 | Headless CMS + trang admin; chế độ triển lãm/kiosk (toàn màn hình, tự reset); âm thanh phản ứng (Web Audio) |
| Tháng 3–5 | WebXR world-AR cho Chrome Android; tham số hoá tác phẩm trong link (màu/seed); bộ sưu tập theo chủ đề |
| Tháng 4–6 | SDK/template để nghệ sĩ khách đóng góp tác phẩm; gói hợp tác thương hiệu (activation sự kiện) làm nguồn doanh thu; đánh giá WebGPU |

---

## 15. Mười việc cần làm đầu tiên (theo thứ tự)

1. **Chốt tên dự án, ngôn ngữ chính (VI hay EN) và phương án nhân sự (A hay B).**
2. Lập **ma trận thiết bị test** (≥ 1 iPhone, 1–2 Android tầm trung, 1 laptop) và mượn/mua máy.
3. Viết **spike MediaPipe** (trang HTML đơn) cho face/hand/pose/segmentation, đo FPS trên từng máy → chốt mục tiêu hiệu năng.
4. Scaffold **Next.js + TypeScript + R3F** trong `D:\laptrinh\VISUAL\WebAR`, khởi tạo git, cấu hình HTTPS khi chạy local.
5. Deploy bản trống lên **Cloudflare Pages** (HTTPS thật để test trên điện thoại).
6. Xây **CameraManager + TrackerHub + EffectRuntime** với hợp đồng module hiệu ứng.
7. Làm **Effect 1 "Mặt Nạ Tinh Thể"** bản thô → chia sẻ link demo nội bộ (mốc cuối tuần 2).
8. Hoàn thiện **luồng quyền camera & trạng thái lỗi**, gồm phát hiện webview mạng xã hội.
9. Song song: **moodboard + typography + wireframe** Home/Gallery/trang tác phẩm.
10. Prototype nhanh **2 hướng cho tác phẩm signature "Dư Ảnh"** và test với 5 người để chọn hướng.

---

## Verification (sau khi duyệt kế hoạch)
- Khi bắt đầu thực thi: bước đầu tiên là việc #3–#5 (spike + scaffold + deploy), kiểm tra bằng cách mở link HTTPS trên điện thoại thật và xem FPS overlay.
- Mỗi effect được nghiệm thu theo cột "Tiêu chí hoàn thành" ở mục 7.
- Quyền riêng tư: kiểm tra tab Network khi đang trải nghiệm — chỉ có request tài nguyên tĩnh và sự kiện analytics, không có payload ảnh.
