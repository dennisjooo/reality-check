"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

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

export function AssetSearch({ onSelect, defaultValue }: AssetSearchProps) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultValue) setQuery(defaultValue);
  }, [defaultValue]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setIsOpen(true);
        setHighlightedIndex(-1);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setHighlightedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      search(value);
    }, 200);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.symbol);
    setIsOpen(false);
    setResults([]);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
    onSelect(result.symbol);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        // If no results visible but user presses enter, try the query as a symbol directly
        setIsOpen(false);
        onSelect(query.trim().toUpperCase());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex]);
        } else if (results.length > 0) {
          handleSelect(results[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search asset (e.g. AAPL, BTC-USD)..."
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        className="w-full"
        autoComplete="off"
        spellCheck={false}
      />

      {isOpen && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg"
        >
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
          )}
          {results.map((result, index) => (
            <button
              key={result.symbol}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                index === highlightedIndex
                  ? "bg-accent"
                  : "hover:bg-accent"
              }`}
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}