import Link from "next/link";
import { EFFECTS, READY_EFFECTS } from "@/effects/registry";
import { CameraIcon, PrismIcon } from "@/ui/icons";
import WorkCard from "@/ui/WorkCard";

export default function Home() {
  const featured = READY_EFFECTS[0];
  const rest = EFFECTS.filter((e) => e.slug !== featured?.slug);
  const soon = EFFECTS.length - READY_EFFECTS.length;

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <div className="pills">
            <span className="pill pill-mint">
              <span className="label-long">Chạy ngay trên trình duyệt</span>
              <span className="label-short">Chạy trên trình duyệt</span>
            </span>
            <span className="pill pill-pink">
              <span className="label-long">Ảnh không rời khỏi máy</span>
              <span className="label-short">Ảnh không rời máy</span>
            </span>
          </div>
          <h1>
            Thế giới thật,
            <br />
            <span className="accent">lệch đi một chút.</span>
          </h1>
          <p className="lead">
            Những tác phẩm kỹ thuật số phản ứng với khuôn mặt, bàn tay và cơ thể bạn. Mở camera ngay trên trình duyệt — không cần cài ứng dụng.
          </p>
          {featured && (
            <div className="hero-actions">
              <Link className="btn primary" href={`/play/${featured.slug}/`}>
                <CameraIcon />
                Thử “{featured.title}”
              </Link>
            </div>
          )}
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="shape s1" />
          <div className="shape s2" />
          <div className="shape s3" />
          <div className="prism">
            <PrismIcon />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Tác phẩm</h2>
          <span className="section-count">
            {READY_EFFECTS.length} đang mở{soon > 0 ? ` · ${soon} sắp ra mắt` : ""}
          </span>
        </div>
        <div className="grid">
          {featured && <WorkCard meta={featured} large index={0} />}
          {rest.map((e, i) => (
            <WorkCard key={e.slug} meta={e} index={i + 1} />
          ))}
        </div>
      </section>

      <section className="manifesto">
        <p>
          Lăng Kính là nơi thử nghiệm: mỗi tác phẩm là một câu hỏi nhỏ về cách cơ thể và hình ảnh của chúng ta có thể bị bẻ cong, kéo giãn, phản chiếu. Mọi thứ diễn ra trên thiết bị của bạn — hình ảnh không bao giờ rời khỏi máy.
        </p>
      </section>
    </main>
  );
}
