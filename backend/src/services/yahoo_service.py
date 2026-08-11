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

    # Buang candle terakhir jika open/low bernilai 0 untuk 1wk / 1mo
    if interval_p in ["1wk", "1mo"] and bars:
        last_bar = bars[-1]
        if last_bar["open"] == 0 or last_bar["high"] == 0 or last_bar["low"] == 0:
            bars.pop()  # Buang bar terakhir dari list

    return bars
