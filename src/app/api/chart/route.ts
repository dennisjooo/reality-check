import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const interval = request.nextUrl.searchParams.get("interval") ?? "1d";

  // Pagination params: period1 & period2 as ISO date strings or unix timestamps
  const period1Param = request.nextUrl.searchParams.get("period1");
  const period2Param = request.nextUrl.searchParams.get("period2");

  // Legacy range param (fallback when period1/period2 not provided)
  const range = request.nextUrl.searchParams.get("range");

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  // Determine period1 and period2
  let period1: Date;
  let period2: Date;

  if (period1Param) {
    // Use explicit time window for pagination
    period1 = parseDateParam(period1Param);
    period2 = period2Param ? parseDateParam(period2Param) : new Date();
  } else if (range) {
    // Legacy range-based mode
    period1 = rangeToPeriod1(range);
    period2 = new Date();
  } else {
    // Default: last 2 years
    period1 = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    period2 = new Date();
  }

  try {
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: interval as "1m" | "5m" | "15m" | "1h" | "1d" | "1wk" | "1mo",
    });

    const quotes = result.quotes
      .filter((q) => q.open !== null && q.close !== null)
      .map((q) => ({
        time: Math.floor(new Date(q.date).getTime() / 1000),
        open: q.open!,
        high: q.high!,
        low: q.low!,
        close: q.close!,
        volume: q.volume ?? 0,
      }));

    return NextResponse.json({ quotes, symbol });
  } catch (error) {
    console.error("Chart error:", error);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}

function parseDateParam(param: string): Date {
  // Try unix timestamp (seconds) first
  const asNumber = Number(param);
  if (!isNaN(asNumber) && asNumber > 1e12) {
    // Looks like milliseconds
    return new Date(asNumber);
  }
  if (!isNaN(asNumber)) {
    // Looks like unix seconds
    return new Date(asNumber * 1000);
  }
  // Try ISO date string
  return new Date(param);
}

function rangeToPeriod1(range: string): Date {
  const now = new Date();
  switch (range) {
    case "1d":
      return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    case "5d":
      return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    case "1mo":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3mo":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "6mo":
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "2y":
      return new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    case "5y":
      return new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
    case "10y":
      return new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
    case "max":
      return new Date(0);
    default:
      return new Date(0);
  }
}