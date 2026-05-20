"use client";

interface StartOverlayProps {
  onStart: () => void;
}

export function StartOverlay({ onStart }: StartOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[2px] z-10 transition-all duration-300">
      <button
        onClick={onStart}
        className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-background/80 border border-border backdrop-blur-md shadow-2xl hover:bg-background/90 hover:scale-105 transition-all duration-300 group"
      >
        <div className="h-16 w-16 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg group-hover:bg-primary/90 transition-colors">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8 translate-x-0.5"
          >
            <path
              fillRule="evenodd"
              d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="text-base font-semibold tracking-tight text-foreground">
            Start Reality Check
          </span>
          <span className="text-xs text-muted-foreground mt-1 max-w-[200px]">
            Click to begin replaying historical candlestick data.
          </span>
        </div>
      </button>
    </div>
  );
}
