"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { ChartData } from "@/lib/types";

export function useChartData(
  ticker: string | null,
  period: string,
  interval: string,
  emaPeriods: number[],
) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getChartData(ticker, period, interval, emaPeriods);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ticker, period, interval, emaPeriods.join(",")]); // eslint-disable-line

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
