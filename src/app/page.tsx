import type { Metadata } from "next";
import { Home } from "@/components/home-content";
import { VALID_SYMBOL_RE } from "@/lib/api-validation";
import { lookupAssetName } from "@/lib/asset-name";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const symbol = (Array.isArray(q) ? q[0] : q)?.trim();
  if (!symbol || !VALID_SYMBOL_RE.test(symbol)) return {};

  const name = await lookupAssetName(symbol);
  const title = `${name ?? symbol} (${symbol}) — Reality Check`;
  const description = `Zoom out on ${name ?? symbol}. See the bigger picture.`;
  const images = [`/api/og?q=${encodeURIComponent(symbol)}`];

  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default function Page() {
  return <Home />;
}
