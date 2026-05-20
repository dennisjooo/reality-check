export function Header() {
  return (
    <header className="flex flex-col gap-8 pt-4 pb-4">
      <div className="space-y-4 sm:space-y-5">
        {/* Title */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-heading italic tracking-tight text-foreground/90">
          Reality Check
        </h1>
        
        {/* Subtitle */}
        <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl font-light">
          Zoom out and see the bigger picture. <br /> Playback historical market data to test your intuition without the risk.
        </p>
      </div>
    </header>
  );
}
