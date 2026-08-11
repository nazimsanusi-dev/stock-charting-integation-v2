"""Yahoo Finance v8 API — uses Cloudflare Workers native fetch."""
from datetime import datetime, timezone

PERIOD_MAP = {
    "3mo": "3mo", "6mo": "6mo", "1y": "1y", "2y": "2y", "5y": "5y", "max": "max",
    "3 Bulan": "3mo", "6 Bulan": "6mo", "1 Tahun": "1y",
    "2 Tahun": "2y", "5 Tahun": "5y", "Max": "max",
}
INTERVAL_MAP = {
    "1d": "1d", "1wk": "1wk", "1mo": "1mo",
    "Harian": "1d", "Mingguan": "1wk", "Bulanan": "1mo",
}


async def fetch_ohlcv(ticker: str, period: str = "1y", interval: str = "1d") -> list[dict]:
    from js import fetch, Headers  # type: ignore[import]

    range_p = PERIOD_MAP.get(period, "1y")
    interval_p = INTERVAL_MAP.get(interval, "1d")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?range={range_p}&interval={interval_p}&includePrePost=false"
    )
    headers = Headers.new({"User-Agent": "Mozilla/5.0 (compatible; StockMonitor/1.0)"}.items())
    resp = await fetch(url, method="GET", headers=headers)
    if not resp.ok:
        raise Exception(f"Yahoo Finance HTTP {resp.status}")

    data = (await resp.json()).to_py()
    result = data.get("chart", {}).get("result")
    if not result:
        return []

    r = result[0]
    timestamps = r.get("timestamp", [])
    quote = r["indicators"]["quote"][0]
    opens = quote.get("open", [])
    highs = quote.get("high", [])
    lows = quote.get("low", [])
    closes = quote.get("close", [])
    volumes = quote.get("volume", [])

    bars: list[dict] = []
    for i, ts in enumerate(timestamps):
        o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        v = volumes[i]
        if any(x is None for x in [o, h, l, c]):
            continue
        bars.append({
            "time": int(ts),
            "open": round(float(o), 4),
            "high": round(float(h), 4),
            "low": round(float(l), 4),
            "close": round(float(c), 4),
            "volume": float(v or 0),
        })

    # Fix incomplete current candle for 1wk / 1mo timeframe
    if interval_p in ["1wk", "1mo"] and bars:
        last_bar = bars[-1]
        if last_bar["open"] == 0 or last_bar["high"] == 0 or last_bar["low"] == 0:
            daily_bars = await fetch_ohlcv(ticker, period=period, interval="1d")
            last_dt = datetime.fromtimestamp(last_bar["time"], tz=timezone.utc)

            matching_daily = []
            for d in daily_bars:
                d_dt = datetime.fromtimestamp(d["time"], tz=timezone.utc)
                if interval_p == "1wk":
                    # Padankan minggu & tahun ISO yang sama
                    if d_dt.isocalendar()[:2] == last_dt.isocalendar()[:2]:
                        matching_daily.append(d)
                elif interval_p == "1mo":
                    # Padankan bulan & tahun yang sama
                    if d_dt.year == last_dt.year and d_dt.month == last_dt.month:
                        matching_daily.append(d)

            if matching_daily:
                bars[-1] = {
                    "time": last_bar["time"],
                    "open": matching_daily[0]["open"],
                    "high": round(max(d["high"] for d in matching_daily), 4),
                    "low": round(min(d["low"] for d in matching_daily), 4),
                    "close": matching_daily[-1]["close"],
                    "volume": float(sum(d["volume"] for d in matching_daily)),
                }
            else:
                # Fallback: jika tiada data harian sepadan, samakan dengan harga close (elak nilai 0.0)
                c = last_bar["close"]
                bars[-1] = {
                    "time": last_bar["time"],
                    "open": c, "high": c, "low": c, "close": c,
                    "volume": last_bar["volume"]
                }

    return bars
