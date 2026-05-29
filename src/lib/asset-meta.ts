export interface AssetMeta {
  name?: string;
  type?: string;
  exchange?: string;
}

/** Resolve display metadata for a symbol via the search API. */
export async function resolveAssetMeta(symbol: string): Promise<AssetMeta | null> {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: Array<{ symbol: string; name: string; type: string; exchange: string }>;
    };
    const results = data.results;
    if (!results?.length) return null;

    const upper = symbol.toUpperCase();
    const match = results.find((r) => r.symbol.toUpperCase() === upper) ?? results[0];

    return {
      name: match.name,
      type: match.type,
      exchange: match.exchange,
    };
  } catch {
    return null;
  }
}
