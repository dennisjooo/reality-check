"use client";

import { useState, useCallback, useRef, useEffect, forwardRef } from "react";
import { createPortal } from "react-dom";
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

export const AssetSearch = forwardRef<HTMLInputElement, AssetSearchProps>(
  function AssetSearch({ onSelect, defaultValue }, forwardedRef) {
    const [query, setQuery] = useState(defaultValue ?? "");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);

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

    const updateDropdownPosition = useCallback(() => {
      const inputEl = inputRef.current;
      if (!inputEl) return;
      const rect = inputEl.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) {
        if (e.key === "Enter" && query.trim()) {
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

    useEffect(() => {
      if (highlightedIndex >= 0 && listRef.current) {
        const item = listRef.current.children[highlightedIndex] as HTMLElement;
        item?.scrollIntoView({ block: "nearest" });
      }
    }, [highlightedIndex]);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        const target = event.target as Node;
        const clickedContainer = containerRef.current?.contains(target);
        const clickedDropdown = listRef.current?.contains(target);
        if (!clickedContainer && !clickedDropdown) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (!isOpen) return;

      updateDropdownPosition();
      window.addEventListener("resize", updateDropdownPosition);
      window.addEventListener("scroll", updateDropdownPosition, true);
      return () => {
        window.removeEventListener("resize", updateDropdownPosition);
        window.removeEventListener("scroll", updateDropdownPosition, true);
      };
    }, [isOpen, updateDropdownPosition]);

    return (
      <div ref={containerRef} className="relative w-full max-w-md overflow-visible">
        <Input
          ref={(node) => {
            inputRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          type="text"
          placeholder="Search asset (e.g. AAPL, BTC-USD)..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="w-full focus-visible:ring-2 focus-visible:ring-inset"
          autoComplete="off"
          spellCheck={false}
        />

        {isOpen &&
          dropdownStyle &&
          createPortal(
            <div
              ref={listRef}
              className="fixed z-[100] max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg"
              style={{
                top: dropdownStyle.top,
                left: dropdownStyle.left,
                width: dropdownStyle.width,
              }}
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
            </div>,
            document.body
          )}
      </div>
    );
  }
);
