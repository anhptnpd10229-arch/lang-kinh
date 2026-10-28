"use client";

import { useState } from "react";
import { TAG_LABEL, type EffectMeta, type EffectTag } from "@/effects/types";
import WorkCard from "./WorkCard";

export default function WorksGrid({ works }: { works: EffectMeta[] }) {
  const [tag, setTag] = useState<EffectTag | null>(null);
  const tags = [...new Set(works.flatMap((w) => w.tags))];
  const shown = tag ? works.filter((w) => w.tags.includes(tag)) : works;

  return (
    <>
      <div className="chips" role="group" aria-label="Lọc theo loại">
        <button className={`chip ${tag === null ? "on" : ""}`} onClick={() => setTag(null)}>Tất cả</button>
        {tags.map((t) => (
          <button key={t} className={`chip ${tag === t ? "on" : ""}`} onClick={() => setTag(t)}>
            {TAG_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="grid">
        {shown.map((w) => <WorkCard key={w.slug} meta={w} />)}
      </div>
    </>
  );
}
