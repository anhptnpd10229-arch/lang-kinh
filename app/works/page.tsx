import type { Metadata } from "next";
import { EFFECTS, READY_EFFECTS } from "@/effects/registry";
import WorksGrid from "@/ui/WorksGrid";

export const metadata: Metadata = { title: "Tác phẩm" };

export default function WorksPage() {
  const soon = EFFECTS.length - READY_EFFECTS.length;
  return (
    <main className="page">
      <div className="section">
        <h1 className="page-title">Tác phẩm</h1>
        <p className="lead">
          {READY_EFFECTS.length} tác phẩm đang mở{soon > 0 ? `, ${soon} sắp ra mắt` : ""}. Chọn một loại để lọc.
        </p>
      </div>
      <WorksGrid works={EFFECTS} />
    </main>
  );
}
