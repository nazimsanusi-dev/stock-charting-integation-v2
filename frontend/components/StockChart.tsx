"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import type { ChartData, SidebarParams } from "@/lib/types";

// Helper Penukar Masa Selamat (Timestamp -> yyyy-mm-dd)
function formatLwcTime(time: any): string {
  if (!time) return "";
  if (typeof time === "number") {
    const d = new Date(time > 1e11 ? time : time * 1000);
    return d.toISOString().split("T")[0];
  }
  if (typeof time === "string") {
    if (/^\d{10,13}$/.test(time)) {
      const num = Number(time);
      const d = new Date(num > 1e11 ? num : num * 1000);
      return d.toISOString().split("T")[0];
    }
    return time.split("T")[0];
  }
  return String(time);
}

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

type DrawingTool = "none" | "long" | "range";

interface LongPositionDrawing {
  type: "long";
  entryTime: string;
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  endTime: string;
}

interface RangeDrawing {
  type: "range";
  startTime: string;
  startPrice: number;
  endTime: string;
  endPrice: number;
  barsCount: number;
}

type DrawingItem = LongPositionDrawing | RangeDrawing;

interface Props {
  data: ChartData;
  config: SidebarParams["chartConfig"];
  ticker: string;
  mini?: boolean;
  theme?: "light" | "dark";
}

export const StockChart = memo(function StockChart({
  data,
  config,
  ticker,
  mini = false,
  theme = "dark",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const mainSeriesRef = useRef<any>(null);

  const [activeTool, setActiveTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);

  // State semasa pengguna sedang 'drag' tetikus
  const [dragStart, setDragStart] = useState<{ x: number; y: number; price: number; timeStr: string; barIdx: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number; price: number; timeStr: string; barIdx: number } | null>(null);

  const C = COLOR_PALETTES[theme];

  // 1. Melukis Semula Canvas Overlay
  const redrawCanvas = useCallback(() => {
    if (mini) return;
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeScale = chart.timeScale();

    // Fungsi Render Item Lukisan
    const renderDrawing = (d: DrawingItem) => {
      if (d.type === "long") {
        const x1 = timeScale.timeToCoordinate(d.entryTime as any);
        const x2 = timeScale.timeToCoordinate(d.endTime as any) ?? (x1 ? x1 + 90 : null);
        const yEntry = series.priceToCoordinate(d.entryPrice);
        const yTp = series.priceToCoordinate(d.tpPrice);
        const ySl = series.priceToCoordinate(d.slPrice);

        if (x1 === null || yEntry === null || yTp === null || ySl === null) return;

        const boxWidth = Math.max(70, (x2 ?? x1 + 90) - x1);

        // Zon TP (Hijau)
        ctx.fillStyle = "rgba(38, 166, 154, 0.22)";
        ctx.fillRect(x1, yTp, boxWidth, yEntry - yTp);
        ctx.strokeStyle = "#26A69A";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1, yTp, boxWidth, yEntry - yTp);

        // Zon SL (Merah)
        ctx.fillStyle = "rgba(239, 83, 80, 0.22)";
        ctx.fillRect(x1, yEntry, boxWidth, ySl - yEntry);
        ctx.strokeStyle = "#EF5350";
        ctx.strokeRect(x1, yEntry, boxWidth, ySl - yEntry);

        // Garisan Entry
        ctx.strokeStyle = "#94a3b8";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, yEntry);
        ctx.lineTo(x1 + boxWidth, yEntry);
        ctx.stroke();
        ctx.setLineDash([]);

        const targetPct = (((d.tpPrice - d.entryPrice) / d.entryPrice) * 100).toFixed(2);
        const stopPct = (((d.entryPrice - d.slPrice) / d.entryPrice) * 100).toFixed(2);
        const riskVal = Math.abs(d.entryPrice - d.slPrice);
        const rrRatio = riskVal > 0 ? (Math.abs(d.tpPrice - d.entryPrice) / riskVal).toFixed(2) : "1.00";

        ctx.fillStyle = theme === "dark" ? "#FFFFFF" : "#111827";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`Target: +${targetPct}%`, x1 + 6, yTp + 13);
        ctx.fillText(`R:R = ${rrRatio}`, x1 + 6, yEntry - 4);
        ctx.fillText(`Stop: -${stopPct}%`, x1 + 6, ySl - 4);
      }

      if (d.type === "range") {
        const x1 = timeScale.timeToCoordinate(d.startTime as any);
        const x2 = timeScale.timeToCoordinate(d.endTime as any);
        const y1 = series.priceToCoordinate(d.startPrice);
        const y2 = series.priceToCoordinate(d.endPrice);

        if (x1 === null || x2 === null || y1 === null || y2 === null) return;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        const priceDiff = d.endPrice - d.startPrice;
        const isUp = priceDiff >= 0;

        ctx.fillStyle = isUp ? "rgba(38, 166, 154, 0.18)" : "rgba(239, 83, 80, 0.18)";
        ctx.fillRect(left, top, width, height);

        ctx.strokeStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(left, top, width, height);
        ctx.setLineDash([]);

        // Garisan Diagonal
        ctx.beginPath();
        ctx.strokeStyle = isUp ? "rgba(38, 166, 154, 0.6)" : "rgba(239, 83, 80, 0.6)";
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const pctDiff = ((priceDiff / d.startPrice) * 100).toFixed(2);
        const label = `${isUp ? "+" : ""}${priceDiff.toFixed(3)} (${pctDiff}%) | ${d.barsCount} Bars`;

        ctx.font = "bold 10px monospace";
        const textWidth = ctx.measureText(label).width;
        const badgeX = left + width / 2 - textWidth / 2 - 6;
        const badgeY = top - 18 < 0 ? top + height + 4 : top - 18;

        ctx.fillStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.fillRect(badgeX, badgeY, textWidth + 12, 16);

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.fillText(label, badgeX + 6, badgeY + 12);
      }
    };

    // Lukis semua yang telah disimpan
    drawings.forEach(renderDrawing);

    // Lukis preview masa nyata semasa 'drag'
    if (dragStart && dragCurrent) {
      if (activeTool === "range") {
        renderDrawing({
          type: "range",
          startTime: dragStart.timeStr,
          startPrice: dragStart.price,
          endTime: dragCurrent.timeStr,
          endPrice: dragCurrent.price,
          barsCount: Math.abs(dragCurrent.barIdx - dragStart.barIdx) + 1,
        });
      } else if (activeTool === "long") {
        const diff = Math.abs(dragCurrent.price - dragStart.price);
        renderDrawing({
          type: "long",
          entryTime: dragStart.timeStr,
          entryPrice: dragStart.price,
          tpPrice: Number((dragStart.price + (diff || dragStart.price * 0.06)).toFixed(3)),
          slPrice: Number((dragStart.price - (diff * 0.5 || dragStart.price * 0.03)).toFixed(3)),
          endTime: dragCurrent.timeStr,
        });
      }
    }
  }, [drawings, dragStart, dragCurrent, activeTool, theme, mini]);

  useEffect(() => {
    redrawCanvas();
  }, [drawings, dragStart, dragCurrent, redrawCanvas]);

  // 2. Inisialisasi TradingView Lightweight Charts
  useEffect(() => {
    if (!containerRef.current || !data.ohlcv?.length) return;

    let destroyed = false;

    import("lightweight-charts").then(
      ({
        createChart,
        ColorType,
        CrosshairMode,
        CandlestickSeries,
        LineSeries,
        HistogramSeries,
      }) => {
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

        const candle = chart.addSeries(CandlestickSeries, {
          upColor: C.up,
          downColor: C.down,
          borderUpColor: C.up,
          borderDownColor: C.down,
          wickUpColor: C.up,
          wickDownColor: C.down,
        });
        mainSeriesRef.current = candle;

        const times = data.ohlcv.map((b) => formatLwcTime(b.time));

        candle.setData(
          data.ohlcv.map((b) => ({
            time: formatLwcTime(b.time) as any,
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
          }))
        );

        // Volum
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
              time: formatLwcTime(b.time) as any,
              value: Number(b.volume || 0),
              color: Number(b.close) >= Number(b.open) ? `${C.up}99` : `${C.down}99`,
            }))
          );
        }

        // EMA Overlays
        if (data.indicators?.ema) {
          Object.entries(data.indicators.ema).forEach(([period, values], idx) => {
            const points = values
              .map((v, i) =>
                v !== null
                  ? { time: times[i] as any, value: Number(v) }
                  : null
              )
              .filter(Boolean) as any[];

            if (!points.length) return;
            const s = chart.addSeries(LineSeries, {
              color: EMA_COLORS[idx % EMA_COLORS.length],
              lineWidth: 1,
              title: `EMA ${period}`,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            s.setData(points);
          });
        }

        // RSI Pane
        if (!mini && config.showRsi && data.indicators?.rsi) {
          const rsiPoints = data.indicators.rsi
            .map((v, i) =>
              v !== null
                ? { time: times[i] as any, value: Number(v) }
                : null
            )
            .filter(Boolean) as any[];

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

        // MACD Pane
        if (!mini && config.showMacd && data.indicators?.macd) {
          const macdPoints = data.indicators.macd
            .map((v, i) =>
              v !== null
                ? { time: times[i] as any, value: Number(v) }
                : null
            )
            .filter(Boolean) as any[];
          const sigPoints = (data.indicators.macd_signal || [])
            .map((v, i) =>
              v !== null
                ? { time: times[i] as any, value: Number(v) }
                : null
            )
            .filter(Boolean) as any[];
          const histPoints = (data.indicators.macd_histogram || [])
            .map((v, i) =>
              v !== null
                ? {
                    time: times[i] as any,
                    value: Number(v),
                    color: Number(v) >= 0 ? C.up : C.down,
                  }
                : null
            )
            .filter(Boolean) as any[];

          if (macdPoints.length) {
            const macdPane = chart.addPane();
            if (histPoints.length) {
              const h = macdPane.addSeries(HistogramSeries, {
                priceLineVisible: false,
                lastValueVisible: false,
              });
              h.setData(histPoints);
            }
            const m = macdPane.addSeries(LineSeries, {
              color: C.macd,
              lineWidth: 1,
              title: "MACD",
              priceLineVisible: false,
              lastValueVisible: true,
            });
            m.setData(macdPoints);

            if (sigPoints.length) {
              const s = macdPane.addSeries(LineSeries, {
                color: C.macdSignal,
                lineWidth: 1,
                title: "Signal",
                priceLineVisible: false,
                lastValueVisible: true,
              });
              s.setData(sigPoints);
            }
          }
        }

        // CVD Pane
        if (!mini && config.showCvd && data.indicators?.cvd) {
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

            cvdSeries.setData(
              cvdCandles.map((c, i) => ({
                time: times[i] as any,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
              }))
            );
          }
        }

        // CMF Pane
        if (!mini && config.showCmf && data.indicators?.cmf) {
          const cmfPoints = data.indicators.cmf
            .map((v, i) =>
              v !== null
                ? { time: times[i] as any, value: Number(v) }
                : null
            )
            .filter(Boolean) as any[];

          if (cmfPoints.length) {
            const cmfPane = chart.addPane();
            const cmf = cmfPane.addSeries(LineSeries, {
              color: C.cmf,
              lineWidth: 1,
              title: "CMF(20)",
              priceLineVisible: false,
              lastValueVisible: true,
            });
            cmf.setData(cmfPoints);

            const zeroLine = cmfPane.addSeries(LineSeries, {
              color: C.zeroLine,
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            zeroLine.setData(cmfPoints.map((p) => ({ time: p.time, value: 0 })));
          }
        }

        // Sinkronisasi Canvas semasa Zoom / Scroll
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          redrawCanvas();
        });

        if (data.ohlcv.length > 0) {
          const totalBars = data.ohlcv.length;
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, totalBars - 105),
            to: totalBars - 1,
          });
        } else {
          chart.timeScale().fitContent();
        }

        redrawCanvas();
      }
    );

    return () => {
      destroyed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [data, config, mini, theme, redrawCanvas]);

  // 3. Pengendali Drag Tetikus Interaktif
  const getCoordinatesFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return null;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = series.coordinateToPrice(y);
    const logical = chart.timeScale().coordinateToLogical(x);

    if (price === null || logical === null) return null;

    const bars = data.ohlcv;
    const barIdx = Math.min(Math.max(0, Math.floor(logical)), bars.length - 1);
    const timeStr = formatLwcTime(bars[barIdx]?.time);

    return { x, y, price: Number(price.toFixed(3)), timeStr, barIdx };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "none" || mini) return;
    const coord = getCoordinatesFromEvent(e);
    if (!coord) return;

    setDragStart(coord);
    setDragCurrent(coord);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart || activeTool === "none" || mini) return;
    const coord = getCoordinatesFromEvent(e);
    if (!coord) return;

    setDragCurrent(coord);
  };

  const handleMouseUp = () => {
    if (!dragStart || !dragCurrent || activeTool === "none") {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    if (activeTool === "range") {
      const barsCount = Math.abs(dragCurrent.barIdx - dragStart.barIdx) + 1;
      const isStartFirst = dragStart.barIdx <= dragCurrent.barIdx;

      setDrawings((prev) => [
        ...prev,
        {
          type: "range",
          startTime: isStartFirst ? dragStart.timeStr : dragCurrent.timeStr,
          startPrice: isStartFirst ? dragStart.price : dragCurrent.price,
          endTime: isStartFirst ? dragCurrent.timeStr : dragStart.timeStr,
          endPrice: isStartFirst ? dragCurrent.price : dragStart.price,
          barsCount,
        },
      ]);
    } else if (activeTool === "long") {
      const diff = Math.abs(dragCurrent.price - dragStart.price);
      setDrawings((prev) => [
        ...prev,
        {
          type: "long",
          entryTime: dragStart.timeStr,
          entryPrice: dragStart.price,
          tpPrice: Number((dragStart.price + (diff || dragStart.price * 0.06)).toFixed(3)),
          slPrice: Number((dragStart.price - (diff * 0.5 || dragStart.price * 0.03)).toFixed(3)),
          endTime: dragCurrent.timeStr,
        },
      ]);
    }

    setDragStart(null);
    setDragCurrent(null);
    setActiveTool("none");
  };

  return (
    <div className="flex flex-col h-full w-full select-none">
      {!mini && (
        <div className="flex flex-wrap items-center justify-between px-2.5 py-1.5 bg-gray-100/90 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[11px] gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-400 mr-1 text-[10px]">TOOLS:</span>

            <button
              type="button"
              onClick={() => {
                setActiveTool("none");
                setDragStart(null);
                setDragCurrent(null);
              }}
              className={`px-2 py-0.5 rounded border transition ${
                activeTool === "none"
                  ? "bg-gray-300 dark:bg-gray-700 font-bold border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
              title="Kursor Biasa"
            >
              👆 Pointer
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("long")}
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                activeTool === "long"
                  ? "bg-[#26A69A]/20 text-[#26A69A] border-[#26A69A] font-bold"
                  : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
              title="Klik & seret pada carta untuk menetapkan Long Position (TP/SL)"
            >
              📈 Long Position
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("range")}
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                activeTool === "range"
                  ? "bg-sky-500/20 text-sky-400 border-sky-500 font-bold"
                  : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
              title="Klik & seret pada carta untuk mengukur Julat Harga & Bilangan Lilin"
            >
              📐 Price & Date Range
            </button>
          </div>

          {drawings.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDrawings([]);
                redrawCanvas();
              }}
              className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium px-2 py-0.5 rounded hover:bg-rose-500/10 transition text-[10px]"
            >
              🗑️ Padam Lukisan ({drawings.length})
            </button>
          )}
        </div>
      )}

      <div className="relative flex-1 w-full" style={{ minHeight: mini ? 200 : 550 }}>
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {!mini && (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`absolute inset-0 w-full h-full z-10 ${
              activeTool !== "none" ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
            }`}
          />
        )}
      </div>
    </div>
  );
});