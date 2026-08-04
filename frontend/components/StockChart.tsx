"use client";

import { useEffect, useRef, memo } from "react";
import type { ChartData, ChartConfig } from "@/lib/types";

// Palette Warna Light & Dark
const COLOR_PALETTES = {
  light: {
    up: "#26A69A",
    down: "#EF5350",
    bg: "#FFFFFF",
    grid: "#F0F0F0",
    text: "#424242",
    rsi: "#9C27B0",
    macd: "#2196F3",
    macdSignal: "#FF9800",
    cvd: "#00BCD4",
    cmf: "#4CAF50",
    level: "#BDBDBD",
    zeroLine: "#000000",
  },
  dark: {
    up: "#26A69A",
    down: "#EF5350",
    bg: "#111827",
    grid: "#1F2937",
    text: "#D1D5DB",
    rsi: "#AB47BC",
    macd: "#42A5F5",
    macdSignal: "#FFA726",
    cvd: "#26C6DA",
    cmf: "#66BB6A",
    level: "#4B5563",
    zeroLine: "#FFFFFF",
  },
};

const EMA_COLORS = ["#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#00BCD4", "#8BC34A"];

interface Props {
  data: ChartData;
  config: ChartConfig;
  ticker: string;
  mini?: boolean;
  theme?: "light" | "dark";
}

export const StockChart = memo(function StockChart({
  data,
  config,
  ticker,
  mini = false,
  theme = "light",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts")["createChart"]> | null>(null);

  const C = COLOR_PALETTES[theme];

  useEffect(() => {
    if (!containerRef.current || !data.ohlcv.length) return;

    let destroyed = false;

    import("lightweight-charts").then(
      ({ createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries }) => {
        if (destroyed || !containerRef.current) return;

        chartRef.current?.remove();

        // 1. Cipta Main Chart
        const chart = createChart(containerRef.current!, {
          layout: {
            background: { type: ColorType.Solid, color: C.bg },
            textColor: C.text,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: mini ? 9 : 11,
          },
          grid: {
            vertLines: { color: C.grid },
            horzLines: { color: C.grid },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: C.grid },
          timeScale: { borderColor: C.grid, timeVisible: !mini },
          autoSize: true,
        });
        chartRef.current = chart;

        // 2. Candlestick Utama
        const candle = chart.addSeries(CandlestickSeries, {
          upColor: C.up,
          downColor: C.down,
          borderUpColor: C.up,
          borderDownColor: C.down,
          wickUpColor: C.up,
          wickDownColor: C.down,
        });

        const times = data.ohlcv.map((b) => b.time);

        candle.setData(
          data.ohlcv.map((b) => ({
            time: b.time as unknown as import("lightweight-charts").Time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          }))
        );

        // 3. Volume Overlay pada Main Chart
        if (config.showVolume) {
          const volSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "vol",
            lastValueVisible: false,
            priceLineVisible: false,
          });
          chart.priceScale("vol").applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
            borderVisible: false,
          });
          volSeries.setData(
            data.ohlcv.map((b) => ({
              time: b.time as unknown as import("lightweight-charts").Time,
              value: b.volume,
              color: b.close >= b.open ? `${C.up}99` : `${C.down}99`,
            }))
          );
        }

        // 4. EMA Overlays
        Object.entries(data.indicators.ema).forEach(([period, values], idx) => {
          const points = values
            .map((v, i) =>
              v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null
            )
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];

          if (!points.length) return;
          const s = chart.addSeries(LineSeries, {
            color: EMA_COLORS[idx % EMA_COLORS.length],
            lineWidth: 1,
            title: "",
            priceLineVisible: false,
            lastValueVisible: false,
          });
          s.setData(points);
        });

        // 5. RSI Pane Fizikal Terasing
        if (!mini && config.showRsi) {
          const rsiPoints = data.indicators.rsi
            .map((v, i) =>
              v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null
            )
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];

          if (rsiPoints.length) {
            const rsiPane = chart.addPane();
            const rsiSeries = rsiPane.addSeries(LineSeries, {
              color: C.rsi,
              lineWidth: 1,
              title: "RSI(14)",
              priceLineVisible: false,
              lastValueVisible: true,
            });
            rsiSeries.setData(rsiPoints);

            [70, 30].forEach((lvl) => {
              const line = rsiPane.addSeries(LineSeries, {
                color: C.level,
                lineWidth: 1,
                lineStyle: 2,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              line.setData(rsiPoints.map((p) => ({ time: p.time, value: lvl })));
            });
          }
        }

        // 6. MACD Pane Fizikal Terasing
        if (!mini && config.showMacd) {
          const macdPoints = data.indicators.macd
            .map((v, i) => (v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null))
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];
          const sigPoints = data.indicators.macd_signal
            .map((v, i) => (v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null))
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];
          const histPoints = data.indicators.macd_histogram
            .map((v, i) => (v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v, color: v >= 0 ? C.up : C.down } : null))
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number; color: string }[];

          if (macdPoints.length) {
            const macdPane = chart.addPane();
            if (histPoints.length) {
              const h = macdPane.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
              h.setData(histPoints);
            }
            const m = macdPane.addSeries(LineSeries, { color: C.macd, lineWidth: 1, title: "MACD", priceLineVisible: false, lastValueVisible: true });
            m.setData(macdPoints);

            if (sigPoints.length) {
              const s = macdPane.addSeries(LineSeries, { color: C.macdSignal, lineWidth: 1, title: "Signal", priceLineVisible: false, lastValueVisible: true });
              s.setData(sigPoints);
            }
          }
        }

        // 7. CVD Candlestick Pane Fizikal Terasing
        if (!mini && config.showCvd) {
          const cvdCandles = data.indicators.cvd as unknown as Array<{
            open: number;
            high: number;
            low: number;
            close: number;
          }>;

          if (cvdCandles && cvdCandles.length) {
            const cvdPane = chart.addPane();
            const cvdSeries = cvdPane.addSeries(CandlestickSeries, {
              upColor: C.up,
              downColor: C.down,
              borderUpColor: C.up,
              borderDownColor: C.down,
              wickUpColor: C.up,
              wickDownColor: C.down,
              priceLineVisible: false,
              lastValueVisible: true,
              title: "CVD",
            });

            const formattedData = cvdCandles.map((c, i) => ({
              time: times[i] as unknown as import("lightweight-charts").Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }));

            cvdSeries.setData(formattedData);
          }
        }

        // 8. CMF Pane Fizikal Terasing
        if (!mini && config.showCmf) {
          const cmfPoints = data.indicators.cmf
            .map((v, i) => (v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null))
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];

          if (cmfPoints.length) {
            const cmfPane = chart.addPane();

            // 1. Garisan CMF utama
            const cmf = cmfPane.addSeries(LineSeries, {
              color: C.cmf,
              lineWidth: 1,
              title: "CMF(20)",
              priceLineVisible: false,
              lastValueVisible: true,
            });
            cmf.setData(cmfPoints);

            // 2. Garisan horizontal 0.00 (Putus-putus)
            const zeroLine = cmfPane.addSeries(LineSeries, {
              color: C.zeroLine,
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            });

            zeroLine.setData(
              cmfPoints.map((p) => ({ time: p.time, value: 0 }))
            );
          }
        }

        chart.timeScale().fitContent();
      }
    );

    return () => {
      destroyed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [data, config, mini, theme]);

  return <div ref={containerRef} className="w-full" style={{ height: "100%", minHeight: mini ? 200 : 550 }} />;
});