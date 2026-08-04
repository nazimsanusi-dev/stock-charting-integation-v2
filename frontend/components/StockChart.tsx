"use client";

import { useEffect, useRef, memo } from "react";
import type { ChartData, ChartConfig } from "@/lib/types";

const C = {
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
};

const EMA_COLORS = ["#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#00BCD4", "#8BC34A"];

interface Props {
  data: ChartData;
  config: ChartConfig;
  ticker: string;
  mini?: boolean;
}

export const StockChart = memo(function StockChart({ data, config, ticker, mini = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts")["createChart"]> | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.ohlcv.length) return;

    let destroyed = false;

    import("lightweight-charts").then(
      ({ createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries }) => {
        if (destroyed || !containerRef.current) return;

        chartRef.current?.remove();

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

        // ── Candlestick ──────────────────────────────────────────────────────
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
          })),
        );

        // ── Volume overlay ────────────────────────────────────────────────────
        if (config.showVolume) {
          const volSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "vol",
            lastValueVisible: false,
            priceLineVisible: false,
          });
          chart.priceScale("vol").applyOptions({
            scaleMargins: { top: 0.78, bottom: 0 },
            borderVisible: false,
          });
          volSeries.setData(
            data.ohlcv.map((b) => ({
              time: b.time as unknown as import("lightweight-charts").Time,
              value: b.volume,
              color: b.close >= b.open ? `${C.up}99` : `${C.down}99`,
            })),
          );
        }

        // ── EMA overlays (Title/Badge Dibuang) ────────────────────────────────
        Object.entries(data.indicators.ema).forEach(([period, values], idx) => {
          const points = values
            .map((v, i) =>
              v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null,
            )
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];

          if (!points.length) return;
          const s = chart.addSeries(LineSeries, {
            color: EMA_COLORS[idx % EMA_COLORS.length],
            lineWidth: 1,
            title: "", // Kosongkan title supaya tak semak kat axis
            priceLineVisible: false,
            lastValueVisible: false,
          });
          s.setData(points);
        });

        // ── Sub-indicator Helper (RSI, MACD, CVD, CMF) ────────────────────────
        let currentMarginTop = 0.65;

        function addSubIndicator(
          scaleId: string,
          setup: (scaleId: string) => void
        ) {
          chart.priceScale(scaleId).applyOptions({
            scaleMargins: { top: currentMarginTop, bottom: 0 },
            borderVisible: false,
          });
          currentMarginTop += 0.15;
          setup(scaleId);
        }

        // ── RSI ──────────────────────────────────────────────────────────────
        if (!mini && config.showRsi) {
          const rsiPoints = data.indicators.rsi
            .map((v, i) =>
              v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null,
            )
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];

          if (rsiPoints.length) {
            addSubIndicator("rsi", (scaleId) => {
              const rsiSeries = chart.addSeries(LineSeries, {
                color: C.rsi,
                lineWidth: 1,
                title: "RSI(14)",
                priceScaleId: scaleId,
                priceLineVisible: false,
                lastValueVisible: true,
              });
              rsiSeries.setData(rsiPoints);

              [70, 30].forEach((lvl) => {
                const line = chart.addSeries(LineSeries, {
                  color: C.level,
                  lineWidth: 1,
                  lineStyle: 2,
                  priceScaleId: scaleId,
                  priceLineVisible: false,
                  lastValueVisible: false,
                });
                line.setData(rsiPoints.map((p) => ({ time: p.time, value: lvl })));
              });
            });
          }
        }

        // ── MACD ─────────────────────────────────────────────────────────────
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
            addSubIndicator("macd", (scaleId) => {
              if (histPoints.length) {
                const h = chart.addSeries(HistogramSeries, { priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
                h.setData(histPoints);
              }
              const m = chart.addSeries(LineSeries, { color: C.macd, lineWidth: 1, title: "MACD", priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: true });
              m.setData(macdPoints);

              if (sigPoints.length) {
                const s = chart.addSeries(LineSeries, { color: C.macdSignal, lineWidth: 1, title: "Signal", priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: true });
                s.setData(sigPoints);
              }
            });
          }
        }

        // ── CVD ──────────────────────────────────────────────────────────────
        if (!mini && config.showCvd) {
          const cvdPoints = data.indicators.cvd
            .map((v, i) => (v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null))
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];

          if (cvdPoints.length) {
            addSubIndicator("cvd", (scaleId) => {
              const cvd = chart.addSeries(LineSeries, { color: C.cvd, lineWidth: 1, title: "CVD", priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: true });
              cvd.setData(cvdPoints);
            });
          }
        }

        // ── CMF ──────────────────────────────────────────────────────────────
        if (!mini && config.showCmf) {
          const cmfPoints = data.indicators.cmf
            .map((v, i) => (v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null))
            .filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[];

          if (cmfPoints.length) {
            addSubIndicator("cmf", (scaleId) => {
              const cmf = chart.addSeries(LineSeries, { color: C.cmf, lineWidth: 1, title: "CMF(20)", priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: true });
              cmf.setData(cmfPoints);
            });
          }
        }

        chart.timeScale().fitContent();
      },
    );

    return () => {
      destroyed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [data, config, mini]);

  return <div ref={containerRef} className="w-full" style={{ height: "100%", minHeight: mini ? 200 : 420 }} />;
});