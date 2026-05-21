"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";

interface HeaderProps {
  symbol: string;
}

export function Header({ symbol }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="flex items-center justify-between gap-4 px-1 py-2">
      {/* Left: editorial title + asset */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-xl sm:text-2xl font-heading italic tracking-tight text-foreground/80 shrink-0">
          Reality Check
        </h1>
        <span className="text-border/80 hidden sm:inline select-none" aria-hidden="true">·</span>
        <span className="text-lg sm:text-xl font-heading tracking-tight text-foreground truncate hidden sm:inline">
          {symbol}
        </span>
      </div>

      {/* Mobile: show asset name centered */}
      <span className="text-lg font-heading tracking-tight text-foreground truncate sm:hidden flex-1 text-center">
        {symbol}
      </span>

      {/* Right: utility actions */}
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
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
