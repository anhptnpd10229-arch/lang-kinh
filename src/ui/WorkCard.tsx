import Link from "next/link";
import { TAG_LABEL, type EffectMeta } from "@/effects/types";

/** Thẻ tác phẩm. Ảnh đại diện tạm là mảng màu theo `accent` cho tới khi có video preview. */
export default function WorkCard({ meta, large = false }: { meta: EffectMeta; large?: boolean }) {
  return (
    <Link href={`/works/${meta.slug}/`} className={`card ${large ? "card-large" : ""}`}>
      <div className="poster" style={{ "--accent": meta.accent } as React.CSSProperties}>
        {meta.status === "soon" && <span className="badge">Sắp ra mắt</span>}
      </div>
      <div className="card-meta">
        <h3>{meta.title}</h3>
        <p>{meta.tagline}</p>
        <span className="tags">
          {meta.tags.map((t) => TAG_LABEL[t]).join(" · ")} · {meta.weight}
        </span>
      </div>
    </Link>
  );
}
