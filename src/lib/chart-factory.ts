import type { IChartApi } from "lightweight-charts";
import { ColorType } from "lightweight-charts";
import type { ChartType } from "@/lib/chart-types";
import { getChartTheme, getPriceFormat } from "@/lib/chart-utils";
import type { ChartData } from "@/lib/chart-types";
import { addPriceSeries, addVolumeSeries } from "@/lib/chart-series";

interface ChartOptions {
  chartType: ChartType;
  lineColor?: string;
  fontFamily?: string;
}

/**
 * Create a lightweight-charts instance with the app's standard configuration,
 * add the price + volume series, and return the chart + series refs.
 */
export function createChartInstance(
  container: HTMLDivElement,
  quotes: ChartData[],
  options: ChartOptions,
): {
  chart: IChartApi;
  series: ReturnType<IChartApi["addSeries"]>;
  volumeSeries: ReturnType<IChartApi["addSeries"]>;
} {
  const isDark = document.documentElement.classList.contains("dark");
  const theme = getChartTheme(isDark);
  const priceFormat = getPriceFormat(quotes);

  const chart = createChartLib(container, {
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: theme.textColor,
      fontFamily: options.fontFamily ?? "var(--font-urbanist), Inter, system-ui, sans-serif",
    },
    grid: {
      vertLines: { color: theme.gridColor },
      horzLines: { color: theme.gridColor },
    },
    crosshair: {
      mode: 0,
    },
    rightPriceScale: {
      borderColor: theme.borderColor,
    },
    timeScale: {
      borderColor: theme.borderColor,
      timeVisible: true,
      secondsVisible: false,
      minBarSpacing: 0.01,
    },
  });

  chart.applyOptions({
    width: container.clientWidth,
    height: container.clientHeight,
  });

  const series = addPriceSeries(chart, options.chartType, quotes, priceFormat, options.lineColor ?? "#3b82f6");
  const volumeSeries = addVolumeSeries(chart, quotes);

  return { chart, series, volumeSeries };
}

/**
 * Re-export createChart from lightweight-charts so the factory
 * doesn't need the consumer to import it separately.
 */
import { createChart as createChartLib } from "lightweight-charts";