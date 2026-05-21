"use client";

import type { PriceSnapshot } from "@/lib/chart-types";

interface PriceDisplayProps {
  snapshot: PriceSnapshot | null;
}

function formatPrice(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (abs >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export function PriceDisplay({ snapshot }: PriceDisplayProps) {
  if (!snapshot) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground/70 tabular-nums">
          --
        </span>
      </div>
    );
  }

  const delta = snapshot.lastClose - snapshot.firstClose;
  const pct = snapshot.firstClose === 0 ? 0 : (delta / snapshot.firstClose) * 100;
  const isUp = delta >= 0;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <span className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {formatPrice(snapshot.lastClose)}
      </span>
      <span
        className={`rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${
          isUp
            ? "border-emerald-300/25 bg-emerald-400/12 text-emerald-300"
            : "border-red-300/25 bg-red-400/12 text-red-300"
        }`}
      >
        {isUp ? "+" : ""}
        {formatPrice(delta)} ({isUp ? "+" : ""}
        {pct.toFixed(2)}%)
      </span>
    </div>
  );
}
