"use client";

interface CompletionOverlayProps {
  visible: boolean;
}

export function CompletionOverlay({ visible }: CompletionOverlayProps) {
  if (!visible) return null;

  return (
    <div className="completion-overlay pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="rounded-2xl border border-white/12 bg-black/35 px-8 py-5 text-center backdrop-blur-md">
        <p className="font-heading text-3xl italic tracking-tight text-white/90">
          The Full Picture
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/55">
          Zoomed Out
        </p>
      </div>
    </div>
  );
}
