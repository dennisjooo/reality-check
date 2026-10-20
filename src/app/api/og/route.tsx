import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { VALID_SYMBOL_RE } from "@/lib/api-validation";
import { lookupAssetName } from "@/lib/asset-name";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const symbol = q && VALID_SYMBOL_RE.test(q) ? q : null;
  const name = symbol ? await lookupAssetName(symbol) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ fontSize: 36, opacity: 0.6 }}>Reality Check</div>
        <div style={{ fontSize: 140, fontWeight: 700, marginTop: 24 }}>{symbol ?? "Zoom out."}</div>
        <div style={{ fontSize: 48, opacity: 0.8 }}>{name ?? "See the bigger picture."}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
