"use client";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetSearch } from "@/components/asset-search";
import { PlaybackControls } from "@/components/playback-controls";
import type { AnimPhase } from "@/lib/chart-types";
import { ControlBus } from "@/lib/control-bus";

interface ActionBarProps {
  symbol: string;
  phase: AnimPhase;
  controlBus: ControlBus;
  searchInputRef: React.RefObject<HTMLButtonElement | null>;
  onSymbolSelect: (symbol: string) => void;
  onPhaseChange: (phase: AnimPhase) => void;
  onSettingsOpen: () => void;
}

export function ActionBar({
  symbol,
  phase,
  controlBus,
  searchInputRef,
  onSymbolSelect,
  onPhaseChange,
  onSettingsOpen,
}: ActionBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm shadow-sm w-full">
      {/* Search */}
      <div className="w-full sm:max-w-sm shrink-0">
        <AssetSearch
          ref={searchInputRef}
          onSelect={onSymbolSelect}
          defaultValue={symbol}
        />
      </div>

      {/* Playback Controls + Settings */}
      <div className="flex items-center gap-2">
        <PlaybackControls
          phase={phase}
          controlBus={controlBus}
          onPhaseChange={onPhaseChange}
        />
        <div className="w-px h-5 bg-border/50 hidden sm:block" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsOpen}
          title="Settings"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </div>
  );
}
