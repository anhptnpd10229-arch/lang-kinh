import type { Metadata } from "next";
import { EFFECTS } from "@/effects/registry";
import WorksGrid from "@/ui/WorksGrid";

export const metadata: Metadata = { title: "Tác phẩm" };

export default function WorksPage() {
  return (
    <main className="page">
      <h1 className="page-title">Tác phẩm</h1>
      <WorksGrid works={EFFECTS} />
    </main>
  );
}
