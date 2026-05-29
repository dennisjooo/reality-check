import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import {
  yahooFinance,
  YAHOO_NO_VALIDATE,
  mapSearchQuotes,
} from "@/lib/yahoo-finance-client";

// --- Rate Limiter ---
const rateLimiter = createRateLimiter({
  name: "api-search",
  limit: 30,
  windowSeconds: 60,
});

// --- Input Validation ---
const MAX_QUERY_LENGTH = 50;
// Strip control characters (C0/C1) but allow normal Unicode
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f-\x9f]/g;

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

  // --- Validate query ---
  const rawQuery = request.nextUrl.searchParams.get("q");

  if (!rawQuery || rawQuery.trim().length === 0) {
    const res = NextResponse.json({ results: [] });
    setRateLimitHeaders(res, rateResult);
    return res;
  }

  // Sanitize: strip control characters and enforce length limit
  const query = rawQuery.replace(CONTROL_CHARS_RE, "").trim().slice(0, MAX_QUERY_LENGTH);

  if (query.length === 0) {
    const res = NextResponse.json({ results: [] });
    setRateLimitHeaders(res, rateResult);
    return res;
  }

  try {
    const result = await yahooFinance.search(query, {}, YAHOO_NO_VALIDATE);
    const results = mapSearchQuotes(result);

    const res = NextResponse.json({ results });
    setRateLimitHeaders(res, rateResult);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    // Yahoo schema validation can still throw; use raw result when present
    const fallback = mapSearchQuotes(
      error instanceof Error && "result" in error
        ? (error as { result: unknown }).result
        : null
    );
    if (fallback.length > 0) {
      const res = NextResponse.json({ results: fallback });
      setRateLimitHeaders(res, rateResult);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    console.error("Search failed for query:", query, error);
    const res = NextResponse.json({ results: [] });
    setRateLimitHeaders(res, rateResult);
    return res;
  }
}