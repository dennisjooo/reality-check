"use client";

import { useState, useCallback, useRef, useEffect, forwardRef } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command,
} from "@/components/ui/command";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

interface AssetSearchProps {
  onSelect: (symbol: string) => void;
  defaultValue?: string;
}

export const AssetSearch = forwardRef<HTMLButtonElement, AssetSearchProps>(
  function AssetSearch({ onSelect, defaultValue }, forwardedRef) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const search = useCallback(async (q: string) => {
      if (q.trim().length === 0) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }, []);

    const handleInputChange = (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        search(value);
      }, 200);
    };

    const handleSelect = (result: SearchResult) => {
      setIsOpen(false);
      setQuery("");
      setResults([]);
      onSelect(result.symbol);
    };

    useEffect(() => {
      const down = (e: KeyboardEvent) => {
        if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setIsOpen((open) => !open);
        }
      };
      document.addEventListener("keydown", down);
      return () => document.removeEventListener("keydown", down);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && results.length === 0 && query.trim()) {
        setIsOpen(false);
        onSelect(query.trim().toUpperCase());
        setQuery("");
      }
    };

    return (
      <>
        <Button
          ref={forwardedRef}
          variant="outline"
          className="relative w-full justify-start text-sm text-foreground sm:pr-12 bg-muted/50 font-medium"
          onClick={() => setIsOpen(true)}
        >
          <Search className="mr-2 size-4 shrink-0 opacity-50" />
          <span className="truncate">{defaultValue || "Search asset..."}</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden h-6 -translate-y-1/2 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
          <Command shouldFilter={false} onKeyDown={handleKeyDown}>
            <CommandInput
              placeholder="Search asset (e.g. AAPL, BTC-USD)..."
              value={query}
              onValueChange={handleInputChange}
            />
            <CommandList>
              {loading && <CommandEmpty>Searching...</CommandEmpty>}
              {!loading && results.length === 0 && query && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
              {results.length > 0 && (
                <CommandGroup>
                  {results.map((result) => (
                    <CommandItem
                      key={result.symbol}
                      value={result.symbol}
                      onSelect={() => handleSelect(result)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium">{result.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {result.name}
                        </span>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0 rounded bg-muted px-1.5 py-0.5">
                        {result.type}
                      </span>
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
