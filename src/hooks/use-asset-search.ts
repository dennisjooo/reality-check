"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

interface UseAssetSearchOptions {
  /** Callback when a result is selected. */
  onSelect: (symbol: string, result?: SearchResult) => void;
  /** Default display value for the trigger button. */
  defaultValue?: string;
}

export function useAssetSearch({ onSelect }: UseAssetSearchOptions) {
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

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        search(value);
      }, 200);
    },
    [search],
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setIsOpen(false);
      setQuery("");
      setResults([]);
      onSelect(result.symbol, result);
    },
    [onSelect],
  );

  // Cmd+K shortcut
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && results.length === 0 && query.trim()) {
        setIsOpen(false);
        onSelect(query.trim().toUpperCase());
        setQuery("");
      }
    },
    [results, query, onSelect],
  );

  return {
    query,
    results,
    isOpen,
    loading,
    setIsOpen,
    handleInputChange,
    handleSelect,
    handleKeyDown,
  };
}
