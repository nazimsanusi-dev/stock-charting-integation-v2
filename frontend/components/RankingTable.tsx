"use client";

import type { SubsectorRank } from "@/lib/types";

interface Props {
  data: SubsectorRank[];
  onSelectSubsector?: (subsectorId: number) => void;
}

export function RankingTable({ data, onSelectSubsector }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Tiada data ranking subsektor ditemui.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
          <tr>
            <th className="py-2.5 px-3 w-12 text-center">Rank</th>
            <th className="py-2.5 px-3">Subsektor</th>
            <th className="py-2.5 px-3 text-center">Skor</th>
            <th className="py-2.5 px-3 text-right">5D Return</th>
            <th className="py-2.5 px-3 text-right">20D Return</th>
            <th className="py-2.5 px-3 text-center">Bil. Saham</th>
            <th className="py-2.5 px-3">Status / Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
          {data.map((item) => {
            const is5dPositive = item.return_5d > 0;
            const is5dNegative = item.return_5d < 0;
            const is20dPositive = item.return_20d > 0;
            const is20dNegative = item.return_20d < 0;

            return (
              <tr
                key={item.subsector_id}
                onClick={() => onSelectSubsector?.(item.subsector_id)}
                className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
              >
                {/* Rank Badge */}
                <td className="py-2 px-3 text-center font-bold">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${
                      item.rank === 1
                        ? "bg-amber-500/20 text-amber-500 font-black"
                        : item.rank === 2
                        ? "bg-gray-300/20 text-gray-400 font-bold"
                        : item.rank === 3
                        ? "bg-amber-700/20 text-amber-700 font-bold"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    #{item.rank}
                  </span>
                </td>

                {/* Subsector Name */}
                <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">
                  {item.subsector_name}
                </td>

                {/* Score */}
                <td className="py-2 px-3 text-center font-mono font-bold text-teal-600 dark:text-teal-400">
                  {item.score}
                </td>

                {/* 5D Return */}
                <td
                  className={`py-2 px-3 text-right font-mono font-medium ${
                    is5dPositive
                      ? "text-emerald-500"
                      : is5dNegative
                      ? "text-red-500"
                      : "text-gray-400"
                  }`}
                >
                  {is5dPositive ? `+${item.return_5d}%` : `${item.return_5d}%`}
                </td>

                {/* 20D Return */}
                <td
                  className={`py-2 px-3 text-right font-mono font-medium ${
                    is20dPositive
                      ? "text-emerald-500"
                      : is20dNegative
                      ? "text-red-500"
                      : "text-gray-400"
                  }`}
                >
                  {is20dPositive ? `+${item.return_20d}%` : `${item.return_20d}%`}
                </td>

                {/* Num Stocks */}
                <td className="py-2 px-3 text-center text-gray-500 dark:text-gray-400 font-mono">
                  {item.num_stocks}
                </td>

                {/* Status Tags */}
                <td className="py-2 px-3">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                    {item.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}