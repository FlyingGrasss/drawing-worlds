import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { WorldRoom } from "@/components/world/world-room";
import { normalizeWorldSlug } from "@/lib/worlds/slug";

interface WorldPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: WorldPageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = normalizeWorldSlug(rawSlug);

  return {
    title: `${slug ?? rawSlug} — Drawing Worlds`,
    robots: { index: false, follow: false },
  };
}

export default async function WorldPage({ params }: WorldPageProps) {
  const { slug: rawSlug } = await params;
  const slug = normalizeWorldSlug(rawSlug);

  if (!slug) {
    notFound();
  }

  if (slug !== rawSlug) {
    redirect(`/w/${slug}`);
  }

  return <WorldRoom slug={slug} />;
}
