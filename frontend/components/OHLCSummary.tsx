"use client";

import type { OHLCVBar } from "@/lib/types";

interface Props {
  bar: OHLCVBar | null;
  ticker: string;
}

function fmt(n: number, decimals = 4): string {
  return n.toFixed(decimals);
}

function fmtVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

export function OHLCSummary({ bar, ticker }: Props) {
  if (!bar) return null;

  const change = bar.close - bar.open;
  const pct = (change / bar.open) * 100;
  const isUp = change >= 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
      <span className="font-semibold text-gray-700 dark:text-gray-200">{ticker}</span>

      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">O</span>
        {fmt(bar.open)}
      </span>
      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">H</span>
        {fmt(bar.high)}
      </span>
      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">L</span>
        {fmt(bar.low)}
      </span>
      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">C</span>
        <span className={isUp ? "text-[#26A69A] font-medium" : "text-[#EF5350] font-medium"}>
          {fmt(bar.close)}
        </span>
      </span>

      <span className={isUp ? "text-[#26A69A]" : "text-[#EF5350]"}>
        {isUp ? "▲" : "▼"} {fmt(Math.abs(change))} ({pct >= 0 ? "+" : ""}
        {pct.toFixed(2)}%)
      </span>

      <span>
        <span className="text-gray-400 dark:text-gray-500 mr-1">Vol</span>
        {fmtVolume(bar.volume)}
      </span>
    </div>
  );
}
