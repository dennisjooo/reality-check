"use client";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetSearch, type SearchResult } from "@/components/asset-search";
import { PlaybackControls } from "@/components/playback-controls";
import { DateRangeInput } from "@/components/date-range-input";
import type { AnimPhase } from "@/lib/chart-types";
import { ControlBus } from "@/lib/control-bus";

interface ActionBarProps {
  symbol: string;
  phase: AnimPhase;
  controlBus: ControlBus;
  searchInputRef: React.RefObject<HTMLButtonElement | null>;
  fromDate?: string;
  toDate?: string;
  onSymbolSelect: (symbol: string, result?: SearchResult) => void;
  onPhaseChange: (phase: AnimPhase) => void;
  onDateChange: (from: string | undefined, to: string | undefined) => void;
  onSettingsOpen: () => void;
}

export function ActionBar({
  symbol,
  phase,
  controlBus,
  searchInputRef,
  fromDate,
  toDate,
  onSymbolSelect,
  onPhaseChange,
  onDateChange,
  onSettingsOpen,
}: ActionBarProps) {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-full border border-white/[0.08] bg-card/60 px-2 py-2 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-1">
        <div className="min-w-0 max-w-[40%] flex-1">
          <AssetSearch
            ref={searchInputRef}
            onSelect={onSymbolSelect}
            defaultValue={symbol}
            compact
          />
        </div>
        <span className="mx-0.5 hidden size-1 rounded-full bg-white/20 sm:inline-block" />
        <PlaybackControls
          phase={phase}
          controlBus={controlBus}
          onPhaseChange={onPhaseChange}
        />
        <span className="mx-0.5 hidden size-1 rounded-full bg-white/20 sm:inline-block" />
        <DateRangeInput
          fromDate={fromDate}
          toDate={toDate}
          onDateChange={onDateChange}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsOpen}
          title="Settings"
          className="control-bounce size-9 rounded-full text-muted-foreground hover:text-foreground shrink-0"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </div>
  );
}
