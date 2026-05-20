# Reality Check

Zoom out. See the bigger picture.

A financial chart replay tool that animates historical price data with progressive zoom-out milestones. Load any stock, crypto, or ETF and watch its history unfold from recent candles to the full picture.

## Features

- **Animated chart replay** — progressive zoom-out through configurable milestones (50 → 200 → 500 → 1500 → 5000 bars)
- **Candlestick & line charts** — toggle between views with customizable line colors
- **Volume histogram** — translucent volume bars below the price chart
- **Lazy data loading** — fetches older data on demand during replay
- **Shareable URLs** — encode symbol, speed, chart type, and date range in the URL
- **Dark mode** — theme-aware chart colors
- **Keyboard shortcuts** — full control without touching the mouse

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `R` | Restart from beginning |
| `/` | Focus search |
| `1` | Candlestick mode |
| `2` | Line mode |

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **lightweight-charts** (TradingView)
- **yahoo-finance2** for market data

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout, fonts, theme provider
│   ├── page.tsx            # Main page, state orchestration
│   └── api/
│       ├── chart/route.ts  # Yahoo Finance chart data proxy
│       └── search/route.ts # Asset search proxy
├── components/
│   ├── toolbar.tsx          # Controls: search, speed, type, playback
│   ├── zoom-chart.tsx       # Chart initialization + rendering
│   ├── asset-search.tsx     # Debounced search with dropdown
│   ├── start-overlay.tsx    # Idle state CTA
│   ├── chart-error-boundary.tsx  # Crash recovery
│   └── ui/                  # shadcn/ui primitives
├── hooks/
│   ├── use-settings.ts      # localStorage + URL settings
│   ├── use-chart-data.ts    # Paginated data fetching
│   ├── use-chart-animation.ts # requestAnimationFrame replay engine
│   └── use-keyboard-shortcuts.ts # Global key bindings
└── lib/
    ├── control-bus.ts       # Event-driven playback control
    ├── chart-types.ts       # Shared type definitions
    ├── chart-constants.ts   # Milestones, colors, defaults
    ├── chart-utils.ts       # Theme, price format, outlier detection
    ├── rate-limit.ts        # In-memory sliding window limiter
    └── utils.ts             # cn() class merger
```

### Data Flow

1. User selects a symbol → `AssetSearch` calls `/api/search`
2. `ZoomChart` fetches initial 2-year chunk via `/api/chart`
3. Chart renders with `lightweight-charts` (price + volume series)
4. On play, `useChartAnimation` drives `requestAnimationFrame` loop:
   - Interpolates visible bar count in log space (perceptually uniform zoom)
   - Applies outlier-safe y-axis scaling (IQR fencing)
   - Fetches older data when milestones exceed loaded range
5. `ControlBus` (EventTarget) handles play/pause/reset events — no polling

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Shareable URLs

Append query params to share a specific view:

- `?q=AAPL` — symbol
- `?speed=10` — animation speed (2-20 seconds)
- `?type=line` — chart type (`candlestick` or `line`)
- `?from=2020-01-01&to=2024-12-31` — date range

Example: `/?q=BTC-USD&speed=8&type=candlestick`

## Security

- **CSP headers** restrict all connections to same-origin (`connect-src 'self'`)
- **Rate limiting** (30 req/min per IP) on both API routes
- **Input validation** on all query params (symbol regex, interval whitelist, date parsing)
- **No sensitive data** exposed to client; server errors logged only

## Rate Limits

API routes use an in-memory sliding window limiter (30 requests per 60 seconds per IP). For multi-instance deployments, replace with a Redis-backed implementation (see `src/lib/rate-limit.ts`).
