import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EFFECTS, getEffect } from "@/effects/registry";
import { TAG_LABEL } from "@/effects/types";
import WorkCard from "@/ui/WorkCard";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return EFFECTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const meta = getEffect((await params).slug);
  if (!meta) return {};
  return {
    title: meta.title,
    description: meta.tagline,
    openGraph: { title: meta.title, description: meta.tagline, type: "website" },
  };
}

export default async function WorkPage({ params }: Params) {
  const meta = getEffect((await params).slug);
  if (!meta) notFound();
  const related = EFFECTS.filter((e) => e.slug !== meta.slug && e.tags.some((t) => meta.tags.includes(t))).slice(0, 3);

  return (
    <main className="page work">
      <div className="poster work-poster" style={{ "--accent": meta.accent } as React.CSSProperties} />
      <div className="work-body">
        <span className="tags">
          {meta.tags.map((t) => TAG_LABEL[t]).join(" · ")} · {meta.year}
        </span>
        <h1 className="page-title">{meta.title}</h1>
        <p className="lead">{meta.description}</p>

        <h2>Cách tương tác</h2>
        <ul className="howto">{meta.howTo.map((h) => <li key={h}>{h}</li>)}</ul>

        <h2>Yêu cầu</h2>
        <p>
          Camera {meta.facing === "user" ? "trước" : "sau"} · tải {meta.weight} · Safari (iPhone) hoặc Chrome (Android, máy tính) bản mới.
        </p>

        {meta.status === "ready" ? (
          <Link className="btn primary" href={`/play/${meta.slug}/`}>Bắt đầu trải nghiệm</Link>
        ) : (
          <span className="btn disabled">Sắp ra mắt</span>
        )}
      </div>

      {related.length > 0 && (
        <section>
          <h2>Tác phẩm liên quan</h2>
          <div className="grid">{related.map((e) => <WorkCard key={e.slug} meta={e} />)}</div>
        </section>
      )}
    </main>
  );
}
