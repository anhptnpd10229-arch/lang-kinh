# Kết quả spike MediaPipe (việc #3)

Mục đích: chốt mục tiêu hiệu năng ở mục 11 của `docs/KE-HOACH.md` bằng số đo thật.

## Cách chạy
- Máy tính: `npx serve spike -l 5173` rồi mở http://localhost:5173 (camera chỉ chạy trên `localhost` hoặc HTTPS).
- Điện thoại: cần HTTPS — ví dụ `npx cloudflared tunnel --url http://localhost:5173` hoặc deploy thư mục `spike/` lên Cloudflare Pages.
- Mở bằng Safari/Chrome thật, **không** mở trong Zalo/Facebook/Instagram.

## Quy trình mỗi thiết bị
Với mỗi mô hình (face, hand, pose, seg) × GPU/CPU × 480p: để chạy ~30 giây → bấm "Sao chép kết quả" → dán dòng JSON vào bảng dưới.

## Bảng kết quả
| Thiết bị | Trình duyệt | Mô hình | Delegate | Độ phân giải | FPS TB | FPS min | ms suy luận | ms tải | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

## Kết luận (điền sau khi đo)
- Mục tiêu FPS cho máy tầm trung:
- Delegate mặc định cho iOS / Android:
- Có chạy được 2 mô hình cùng lúc không (cần cho Effect 3 và 5):
