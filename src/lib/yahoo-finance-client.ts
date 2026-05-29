import YahooFinance from "yahoo-finance2";

/** Shared client — validation logging off; per-call validateResult where schemas lag Yahoo. */
export const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
});

export const YAHOO_NO_VALIDATE = { validateResult: false } as const;

const ALLOWED_QUOTE_TYPES = new Set([
  "EQUITY",
  "CRYPTOCURRENCY",
  "ETF",
  "CURRENCY",
]);

type RawSearchQuote = {
  symbol?: string;
  quoteType?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  isYahooFinance?: boolean;
};

export type MappedSearchResult = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};

/** Map raw Yahoo search quotes (unvalidated) into API results. */
export function mapSearchQuotes(raw: unknown): MappedSearchResult[] {
  const quotes = (raw as { quotes?: unknown })?.quotes;
  if (!Array.isArray(quotes)) return [];

  return quotes
    .filter((q): q is RawSearchQuote => typeof q === "object" && q !== null)
    .filter(
      (q) =>
        q.isYahooFinance !== false &&
        typeof q.symbol === "string" &&
        q.symbol.length > 0 &&
        ALLOWED_QUOTE_TYPES.has(q.quoteType ?? "")
    )
    .slice(0, 10)
    .map((q) => ({
      symbol: q.symbol!,
      name: q.shortname ?? q.longname ?? q.symbol!,
      type: q.quoteType ?? "",
      exchange: q.exchange ?? "",
    }));
}
