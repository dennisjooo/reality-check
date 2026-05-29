"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";
import { useAssetSearch, type SearchResult } from "@/hooks/use-asset-search";
export type { SearchResult };
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Command,
} from "@/components/ui/command";

interface AssetSearchProps {
  onSelect: (symbol: string, result?: SearchResult) => void;
  defaultValue?: string;
  compact?: boolean;
}

const POPULAR_ASSETS: SearchResult[] = [
  { symbol: "BTC-USD", name: "Bitcoin USD", type: "CRYPTOCURRENCY", exchange: "CCC" },
  { symbol: "ETH-USD", name: "Ethereum USD", type: "CRYPTOCURRENCY", exchange: "CCC" },
  { symbol: "AAPL", name: "Apple Inc.", type: "EQUITY", exchange: "NMS" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "EQUITY", exchange: "NMS" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "EQUITY", exchange: "NMS" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", type: "EQUITY", exchange: "NMS" },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "EQUITY", exchange: "NMS" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF", exchange: "PCQ" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF", exchange: "NGM" },
  { symbol: "TSLA", name: "Tesla, Inc.", type: "EQUITY", exchange: "NMS" },
  { symbol: "META", name: "Meta Platforms, Inc.", type: "EQUITY", exchange: "NMS" },
  { symbol: "GME", name: "GameStop Corp.", type: "EQUITY", exchange: "NYS" },
];

export const AssetSearch = forwardRef<HTMLButtonElement, AssetSearchProps>(
  function AssetSearch({ onSelect, defaultValue, compact = false }, forwardedRef) {
    const {
      query,
      results,
      isOpen,
      loading,
      setIsOpen,
      handleInputChange,
      handleSelect,
    } = useAssetSearch({ onSelect, defaultValue });

    return (
      <>
        <Button
          ref={forwardedRef}
          variant="outline"
          className={`relative w-full justify-start text-sm text-foreground font-medium ${
            compact
              ? "h-9 rounded-full border-white/10 bg-white/5 pl-3 pr-3 sm:pr-3"
              : "bg-muted/50 sm:pr-12"
          }`}
          onClick={() => setIsOpen(true)}
        >
          <Search className="mr-2 size-4 shrink-0 opacity-50" />
          <span className="truncate">{defaultValue || "Search asset..."}</span>
          {!compact && (
            <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden h-6 -translate-y-1/2 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          )}
        </Button>
        <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search asset (e.g. AAPL, BTC-USD)..."
              value={query}
              onValueChange={handleInputChange}
            />
            <CommandList className="mt-2">
              {loading && <CommandEmpty>Searching...</CommandEmpty>}
              {!loading && query.trim().length === 0 && (
                <CommandGroup heading="Popular">
                  {POPULAR_ASSETS.filter(
                    (a) => !defaultValue || a.symbol !== defaultValue
                  ).map((result) => (
                    <CommandItem
                      key={result.symbol}
                      value={result.symbol}
                      onSelect={() => handleSelect(result)}
                      className="flex w-full items-center gap-3 px-3 py-2 cursor-pointer"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{result.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {result.name}
                        </span>
                      </div>
                      <CommandShortcut className="shrink-0 rounded bg-muted px-1.5 py-0.5 tracking-normal">
                        {result.type}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!loading && results.length === 0 && query.trim().length > 0 && (
                <CommandEmpty>
                  No results found. Pick a symbol from the list to continue.
                </CommandEmpty>
              )}
              {results.length > 0 && (
                <CommandGroup>
                  {results.map((result) => (
                    <CommandItem
                      key={result.symbol}
                      value={result.symbol}
                      onSelect={() => handleSelect(result)}
                      className="flex w-full items-center gap-3 px-3 py-2 cursor-pointer"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{result.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {result.name}
                        </span>
                      </div>
                      <CommandShortcut className="shrink-0 rounded bg-muted px-1.5 py-0.5 tracking-normal">
                        {result.type}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </CommandDialog>
      </>
    );
  }
);
