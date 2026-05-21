import type { PriceSnapshot } from "./chart-types";
import type { IChartApi } from "lightweight-charts";
import { buildRollingSnapshot } from "./animation-math";

/**
 * Attach a getCoordinate closure to a snapshot using the chart and series APIs.
 */
export function attachGetCoordinate(
  snapshot: NonNullable<ReturnType<typeof buildRollingSnapshot>>,
  chart: IChartApi,
  series: NonNullable<ReturnType<IChartApi["addSeries"]>>,
  lastLogicalIndex: number,
): void {
  snapshot.lastLogicalIndex = lastLogicalIndex;
  snapshot.getCoordinate = (barTime: number, p: number) => {
    const ts = chart.timeScale();
    const cx = ts.timeToCoordinate(barTime as any);
    const cy = series.priceToCoordinate(p);
    if (cx !== null && cy !== null) return { x: cx, y: cy };
    return null;
  };
}
