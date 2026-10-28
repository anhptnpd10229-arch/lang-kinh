import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <h1 className="page-title">Không tìm thấy</h1>
      <p className="lead">Tác phẩm này không tồn tại hoặc chưa ra mắt.</p>
      <Link className="btn" href="/works/">Xem tất cả tác phẩm</Link>
    </main>
  );
}
