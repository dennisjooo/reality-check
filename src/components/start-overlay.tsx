"use client";

interface StartOverlayProps {
  onStart: () => void;
}

export function StartOverlay({ onStart }: StartOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 backdrop-blur-sm transition-all duration-500">
      <div className="start-orb pointer-events-none absolute size-[420px] rounded-full bg-[radial-gradient(circle,_rgba(96,165,250,0.22)_0%,_rgba(37,99,235,0.1)_35%,_rgba(15,23,42,0)_72%)]" />
      <button
        onClick={onStart}
        className="group relative flex flex-col items-center gap-5 rounded-3xl border border-white/12 bg-black/35 px-10 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:bg-black/40"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-heading text-4xl italic tracking-tight text-white/92 sm:text-5xl">
            Zoom out.
          </span>
          <span className="text-sm tracking-wide text-white/70">
            See the bigger picture.
          </span>
        </div>

        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/45 bg-white/5 text-white shadow-lg transition-colors group-hover:bg-white/12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-7 w-7 translate-x-0.5"
          >
            <path
              fillRule="evenodd"
              d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
          Press Space to begin
        </span>
      </button>
    </div>
  );
}
