import type { Metadata } from "next";

export const metadata: Metadata = { title: "Quyền riêng tư" };

export default function PrivacyPage() {
  return (
    <main className="page prose">
      <h1 className="page-title">Quyền riêng tư</h1>
      <p className="lead">Hình ảnh từ camera của bạn không bao giờ rời khỏi thiết bị.</p>
      <ul>
        <li>Camera chỉ bật khi bạn bấm “Bắt đầu trải nghiệm”, và tắt ngay khi bạn thoát hoặc chuyển sang tab khác.</li>
        <li>Việc nhận diện khuôn mặt, bàn tay, cơ thể chạy trực tiếp trong trình duyệt. Chúng tôi không ghi hình và không tải khung hình lên máy chủ.</li>
        <li>Ảnh bạn chụp được lưu trên máy của bạn; chỉ được chia sẻ khi bạn tự chọn.</li>
        <li>Chúng tôi chỉ đo các số liệu ẩn danh, tổng hợp (ví dụ: số lượt bắt đầu, khoảng FPS, thời lượng làm tròn) để cải thiện hiệu năng. Không dùng cookie theo dõi.</li>
      </ul>
    </main>
  );
}
