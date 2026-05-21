"use client";

import { useCallback } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangeInputProps {
  fromDate?: string;
  toDate?: string;
  onDateChange: (from: string | undefined, to: string | undefined) => void;
}

function toDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DateRangeInput({
  fromDate,
  toDate: toDateStr,
  onDateChange,
}: DateRangeInputProps) {
  const from = toDate(fromDate);
  const to = toDate(toDateStr);

  const handleFromSelect = useCallback(
    (date: Date | undefined) => {
      onDateChange(toISO(date), toDateStr);
    },
    [onDateChange, toDateStr]
  );

  const handleToSelect = useCallback(
    (date: Date | undefined) => {
      onDateChange(fromDate, toISO(date));
    },
    [onDateChange, fromDate]
  );

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger
          className={`control-bounce flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition-colors ${
            from
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarIcon className="size-3.5" />
          <span className="hidden sm:inline">
            {from ? format(from, "MMM d, yyyy") : "Start"}
          </span>
        </PopoverTrigger>
        {from && (
          <button
            onClick={(e) => { e.stopPropagation(); onDateChange(undefined, toDateStr); }}
            className="control-bounce flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
            title="Clear start date"
          >
            <X className="size-3" />
          </button>
        )}
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-auto rounded-xl border-white/[0.08] bg-card p-0 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.75)]"
        >
          <Calendar
            mode="single"
            selected={from}
            onSelect={handleFromSelect}
            defaultMonth={from}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>

      <span className="text-[10px] text-muted-foreground/50">&ndash;</span>

      <Popover>
        <PopoverTrigger
          className={`control-bounce flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition-colors ${
            to
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="hidden sm:inline">
            {to ? format(to, "MMM d, yyyy") : "End"}
          </span>
          {!from && !to && <CalendarIcon className="size-3.5 sm:hidden" />}
        </PopoverTrigger>
        {to && (
          <button
            onClick={(e) => { e.stopPropagation(); onDateChange(fromDate, undefined); }}
            className="control-bounce flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
            title="Clear end date"
          >
            <X className="size-3" />
          </button>
        )}
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-auto rounded-xl border-white/[0.08] bg-card p-0 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.75)]"
        >
          <Calendar
            mode="single"
            selected={to}
            onSelect={handleToSelect}
            defaultMonth={to}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>

      </div>
  );
}
