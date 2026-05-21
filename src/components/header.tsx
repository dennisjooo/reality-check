"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { PriceDisplay } from "@/components/price-display";
import type { PriceSnapshot } from "@/lib/chart-types";

interface HeaderProps {
  symbol: string;
  assetName?: string;
  assetType?: string;
  exchange?: string;
  priceSnapshot: PriceSnapshot | null;
}

export function Header({
  symbol,
  assetName,
  assetType,
  exchange,
  priceSnapshot,
}: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="px-1 py-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg sm:text-xl font-heading italic tracking-tight text-foreground/75 shrink-0">
          Reality Check
        </h1>
        <div className="flex items-center gap-1 shrink-0">
          <ShareButton />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={
              resolvedTheme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            suppressHydrationWarning
            className="control-bounce h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-heading text-3xl sm:text-4xl tracking-tight text-foreground">
            {assetName ? `${symbol} · ${assetName}` : symbol}
          </p>
          {(assetType || exchange) && (
            <p className="truncate text-xs sm:text-sm text-muted-foreground tracking-wide">
              {[assetType, exchange].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <PriceDisplay snapshot={priceSnapshot} />
      </div>
    </header>
  );
}
