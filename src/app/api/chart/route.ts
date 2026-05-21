import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { VALID_SYMBOL_RE, VALID_INTERVALS, KNOWN_PARAMS, INTERVAL_MAX_DAYS } from "@/lib/api-validation";
import { parseDateParam, rangeToPeriod1 } from "@/lib/date-utils";

const yahooFinance = new YahooFinance();

// --- Rate Limiter ---
const rateLimiter = createRateLimiter({
  name: "api-chart",
  limit: 30,
  windowSeconds: 60,
});

function setRateLimitHeaders(
  response: NextResponse,
  info: { limit: number; remaining: number; reset: number }
): void {
  response.headers.set("X-RateLimit-Limit", String(info.limit));
  response.headers.set("X-RateLimit-Remaining", String(info.remaining));
  response.headers.set("X-RateLimit-Reset", String(info.reset));
}

export async function GET(request: NextRequest) {
  // --- Rate limiting ---
  const clientIp = getClientIp(request);
  const rateResult = rateLimiter(clientIp);

  if (!rateResult.success) {
    const res = NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
    setRateLimitHeaders(res, rateResult);
    res.headers.set(
      "Retry-After",
      String(rateResult.reset - Math.floor(Date.now() / 1000))
    );
    return res;
  }

  // --- Reject unknown query params ---
  for (const key of request.nextUrl.searchParams.keys()) {
    if (!KNOWN_PARAMS.has(key)) {
      const res = NextResponse.json(
        { error: `Unknown parameter: ${key}` },
        { status: 400 }
      );
      setRateLimitHeaders(res, rateResult);
      return res;
    }
  }

  // --- Validate symbol ---
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    const res = NextResponse.json(
      { error: "symbol is required" },
      { status: 400 }
    );
    setRateLimitHeaders(res, rateResult);
    return res;
  }
  if (!VALID_SYMBOL_RE.test(symbol)) {
    const res = NextResponse.json(
      { error: "Invalid symbol format" },
      { status: 400 }
    );
    setRateLimitHeaders(res, rateResult);
    return res;
  }

  // --- Validate interval ---
  const interval = request.nextUrl.searchParams.get("interval") ?? "1d";
  if (!VALID_INTERVALS.has(interval)) {
    const res = NextResponse.json(
      { error: `Invalid interval. Allowed: ${[...VALID_INTERVALS].join(", ")}` },
      { status: 400 }
    );
    setRateLimitHeaders(res, rateResult);
    return res;
  }

  // Pagination params: period1 & period2 as ISO date strings or unix timestamps
  const period1Param = request.nextUrl.searchParams.get("period1");
  const period2Param = request.nextUrl.searchParams.get("period2");

  // Legacy range param (fallback when period1/period2 not provided)
  const range = request.nextUrl.searchParams.get("range");

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
    // Default: last 2 years (clamped by interval limits below)
    period1 = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    period2 = new Date();
  }

  // Sanity-check parsed dates
  if (isNaN(period1.getTime()) || isNaN(period2.getTime())) {
    const res = NextResponse.json(
      { error: "Invalid date parameter" },
      { status: 400 }
    );
    setRateLimitHeaders(res, rateResult);
    return res;
  }

  // Clamp period1 based on Yahoo Finance interval limits
  const maxDays = INTERVAL_MAX_DAYS[interval];
  if (maxDays !== Infinity) {
    const maxBack = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);
    if (period1 < maxBack) {
      period1 = maxBack;
    }
  }

  try {
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: interval as "1h" | "1d" | "1wk" | "1mo",
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

    const res = NextResponse.json({ quotes, symbol });
    setRateLimitHeaders(res, rateResult);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    // Log details server-side only — never expose to client
    console.error("Chart fetch failed for symbol:", symbol, error);
    const message = error instanceof Error ? error.message : "";
    let userError = "Failed to fetch chart data";
    if (message.includes("not available") || message.includes("granularity")) {
      const days = INTERVAL_MAX_DAYS[interval];
      userError = `${interval} data is limited to the last ${days} day${days !== 1 ? "s" : ""} by Yahoo Finance`;
    }
    const res = NextResponse.json(
      { error: userError },
      { status: 500 }
    );
    setRateLimitHeaders(res, rateResult);
    return res;
  }
}