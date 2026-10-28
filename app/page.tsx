import Link from "next/link";
import { EFFECTS, READY_EFFECTS } from "@/effects/registry";
import WorkCard from "@/ui/WorkCard";

export default function Home() {
  const featured = READY_EFFECTS[0];
  const rest = EFFECTS.filter((e) => e.slug !== featured?.slug);

  return (
    <main className="page">
      <section className="hero">
        <h1>
          Thế giới thật,
          <br />
          lệch đi một chút.
        </h1>
        <p className="lead">
          Những tác phẩm kỹ thuật số phản ứng với khuôn mặt, bàn tay và cơ thể bạn. Mở camera ngay trên trình duyệt — không cần cài ứng dụng.
        </p>
        {featured && (
          <Link className="btn primary" href={`/play/${featured.slug}/`}>
            Thử “{featured.title}”
          </Link>
        )}
      </section>

      <section className="grid portfolio">
        {featured && <WorkCard meta={featured} large />}
        {rest.map((e) => <WorkCard key={e.slug} meta={e} />)}
      </section>

      <section className="manifesto">
        <p>
          Lăng Kính là nơi thử nghiệm: mỗi tác phẩm là một câu hỏi nhỏ về cách cơ thể và hình ảnh của chúng ta có thể bị bẻ cong, kéo giãn, phản chiếu. Mọi thứ diễn ra trên thiết bị của bạn — hình ảnh không bao giờ rời khỏi máy.
        </p>
      </section>
    </main>
  );
}
