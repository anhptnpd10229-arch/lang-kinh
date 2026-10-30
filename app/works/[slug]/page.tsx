import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EFFECTS, getEffect } from "@/effects/registry";
import { TAG_LABEL } from "@/effects/types";
import { CameraIcon, DownloadIcon, GlobeIcon } from "@/ui/icons";
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

/** Màu nhãn xoay vòng mint → hồng phấn → lavender. */
const TAG_PILL = ["pill-mint", "pill-pink", "pill-lav"];

export default async function WorkPage({ params }: Params) {
  const meta = getEffect((await params).slug);
  if (!meta) notFound();
  const related = EFFECTS.filter((e) => e.slug !== meta.slug && e.tags.some((t) => meta.tags.includes(t))).slice(0, 3);

  return (
    <main className="page">
      <div className="work">
        <div className="poster work-poster" style={{ "--accent": meta.accent } as React.CSSProperties} aria-hidden="true">
          <span className="dot" />
        </div>

        <div className="work-body">
          <div className="pills">
            {meta.tags.map((t, i) => (
              <span key={t} className={`pill pill-caps ${TAG_PILL[i % TAG_PILL.length]}`}>{TAG_LABEL[t]}</span>
            ))}
            <span className="pill pill-caps pill-sand">{meta.year}</span>
          </div>
          <h1 className="page-title">{meta.title}</h1>
          <p className="lead">{meta.description}</p>

          <div className="work-block">
            <h2>Cách tương tác</h2>
            <ol className="steps">
              {meta.howTo.map((h, i) => (
                <li key={h}>
                  <span className={`step-n tone-${i % 3}`}>{i + 1}</span>
                  <span>{h}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="work-block">
            <h2>Yêu cầu</h2>
            <div className="reqs">
              <span className="req"><CameraIcon size={16} className="tone-0" />Camera {meta.facing === "user" ? "trước" : "sau"}</span>
              <span className="req"><DownloadIcon className="tone-1" />Tải {meta.weight}</span>
              <span className="req"><GlobeIcon className="tone-2" />Safari (iPhone) hoặc Chrome bản mới</span>
            </div>
          </div>

          <div className="work-actions">
            {meta.status === "ready" ? (
              <Link className="btn primary" href={`/play/${meta.slug}/`}>Bắt đầu trải nghiệm</Link>
            ) : (
              <span className="btn disabled">Sắp ra mắt</span>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <h2>Tác phẩm liên quan</h2>
          <div className="grid">
            {related.map((e, i) => <WorkCard key={e.slug} meta={e} index={i} />)}
          </div>
        </section>
      )}
    </main>
  );
}
