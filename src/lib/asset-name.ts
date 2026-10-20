import { yahooFinance, YAHOO_NO_VALIDATE, mapSearchQuotes } from "@/lib/yahoo-finance-client";

/** Server-side display name for a symbol; null on any failure (previews must never break the page). */
export async function lookupAssetName(symbol: string): Promise<string | null> {
  try {
    const results = mapSearchQuotes(await yahooFinance.search(symbol, {}, YAHOO_NO_VALIDATE));
    const upper = symbol.toUpperCase();
    return (results.find((r) => r.symbol.toUpperCase() === upper) ?? results[0])?.name ?? null;
  } catch {
    return null;
  }
}
