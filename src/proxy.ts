import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS enforcement proxy for API routes.
 *
 * Since this app serves its own frontend (same-origin), we only allow
 * requests from the app's own origin. Cross-origin requests from other
 * sites are blocked.
 *
 * In production, set ALLOWED_ORIGIN to your deployed domain.
 * In development, same-origin requests don't carry an Origin header,
 * so they pass through naturally.
 */

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function getAllowedOrigins(request: NextRequest): string[] {
  const origins: string[] = [];

  // Explicit override via environment variable
  const envOrigin = process.env.ALLOWED_ORIGIN;
  if (envOrigin) {
    origins.push(...envOrigin.split(",").map((o) => o.trim()));
  }

  // Always allow same-origin (the app calling its own API)
  origins.push(request.nextUrl.origin);

  return origins;
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins(request);

  // Same-origin requests (navigations, fetch from same page) don't include
  // an Origin header — let them through.
  const isAllowedOrigin = !origin || allowedOrigins.includes(origin);

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    if (isAllowedOrigin) {
      return NextResponse.json(
        {},
        {
          headers: {
            "Access-Control-Allow-Origin": origin ?? allowedOrigins[0],
            ...corsOptions,
          },
        }
      );
    }

    // Reject preflight from disallowed origins
    return new NextResponse(null, { status: 403 });
  }

  // For actual requests, set CORS headers if origin is allowed
  const response = NextResponse.next();

  if (origin && isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    Object.entries(corsOptions).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  } else if (origin && !isAllowedOrigin) {
    // Cross-origin request from disallowed origin — block it
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 }
    );
  }

  return response;
}

// Only apply to API routes
export const config = {
  matcher: "/api/:path*",
};
