import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffect, READY_EFFECTS } from "@/effects/registry";
import Player from "@/ui/Player";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return READY_EFFECTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const meta = getEffect((await params).slug);
  return meta ? { title: `Trải nghiệm ${meta.title}`, description: meta.tagline } : {};
}

export default async function PlayPage({ params }: Params) {
  const meta = getEffect((await params).slug);
  if (!meta || meta.status !== "ready") notFound();
  return <Player meta={meta} />;
}
