import Link from "next/link";
import { TAG_LABEL, type EffectMeta } from "@/effects/types";

/**
 * Thẻ tác phẩm: nền trắng bo tròn, poster pha màu từ `accent` cho tới khi có video preview.
 * `index` chọn màu chữ nhãn xoay vòng lavender → mint → hồng phấn.
 */
export default function WorkCard({ meta, large = false, index = 0 }: { meta: EffectMeta; large?: boolean; index?: number }) {
  return (
    <Link href={`/works/${meta.slug}/`} className={`card ${large ? "card-large" : ""}`}>
      <div className="poster" style={{ "--accent": meta.accent } as React.CSSProperties}>
        {meta.status === "soon" ? (
          <span className="badge">Sắp ra mắt</span>
        ) : (
          <span className="badge badge-ready">● Trải nghiệm được</span>
        )}
      </div>
      <div className="card-meta">
        <h3>{meta.title}</h3>
        <p>{meta.tagline}</p>
        <span className={`tags tone-${index % 3}`}>
          {meta.tags.map((t) => TAG_LABEL[t]).join(" · ")} · {meta.weight}
        </span>
      </div>
    </Link>
  );
}
