"use client";

import type { OHLCVBar } from "@/lib/types";

interface Props {
  bar: OHLCVBar | null;
  ticker: string;
  name?: string;
  prevClose?: number | null;
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

export function OHLCSummary({ bar, ticker, name, prevClose }: Props) {
  if (!bar) return null;

  // Calculates change against previous candle close if available, otherwise intra-candle (Close - Open)
  const basePrice = prevClose ?? bar.open;
  const change = bar.close - basePrice;
  const pct = basePrice !== 0 ? (change / basePrice) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 select-none">
      <div className="flex items-center gap-1.5">
        {name && <span className="font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[120px]">{name}</span>}
        <span className="font-semibold font-mono text-gray-500 dark:text-gray-400">{ticker}</span>
      </div>

      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">O</span>
        <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(bar.open)}</span>
      </span>
      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">H</span>
        <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(bar.high)}</span>
      </span>
      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">L</span>
        <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(bar.low)}</span>
      </span>
      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">C</span>
        <span className={`font-mono font-medium ${isUp ? "text-[#26A69A]" : "text-[#EF5350]"}`}>
          {fmt(bar.close)}
        </span>
      </span>

      <span className={`font-mono font-medium ${isUp ? "text-[#26A69A]" : "text-[#EF5350]"}`}>
        {isUp ? "▲" : "▼"} {fmt(Math.abs(change))} ({pct >= 0 ? "+" : ""}
        {pct.toFixed(2)}%)
      </span>

      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">Vol</span>
        <span className="font-mono text-gray-700 dark:text-gray-300">{fmtVolume(bar.volume)}</span>
      </span>
    </div>
  );
}