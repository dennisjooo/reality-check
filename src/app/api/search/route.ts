import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const result = await yahooFinance.search(query.trim());
    const results = result.quotes
      .filter(
        (q) =>
          q.quoteType === "EQUITY" ||
          q.quoteType === "CRYPTOCURRENCY" ||
          q.quoteType === "ETF" ||
          q.quoteType === "CURRENCY"
      )
      .slice(0, 10)
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname ?? q.longname ?? q.symbol,
        type: q.quoteType,
        exchange: q.exchange,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}