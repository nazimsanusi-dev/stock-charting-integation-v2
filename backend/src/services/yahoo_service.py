"""Yahoo Finance v8 API — replaces yfinance."""
import httpx
from ..models import OHLCVBar

PERIOD_MAP = {
    "3mo": "3mo", "6mo": "6mo", "1y": "1y", "2y": "2y", "5y": "5y", "max": "max",
    # Malay labels from original app
    "3 Bulan": "3mo", "6 Bulan": "6mo", "1 Tahun": "1y",
    "2 Tahun": "2y", "5 Tahun": "5y", "Max": "max",
}

INTERVAL_MAP = {
    "1d": "1d", "1wk": "1wk", "1mo": "1mo",
    "Harian": "1d", "Mingguan": "1wk", "Bulanan": "1mo",
}

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockMonitor/1.0)"}


async def fetch_ohlcv(ticker: str, period: str = "1y", interval: str = "1d") -> list[OHLCVBar]:
    range_p = PERIOD_MAP.get(period, "1y")
    interval_p = INTERVAL_MAP.get(interval, "1d")

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    params = {"range": range_p, "interval": interval_p, "includePrePost": "false"}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params, headers=_HEADERS)
        resp.raise_for_status()

    data = resp.json()
    result = data["chart"]["result"]
    if not result:
        return []

    r = result[0]
    timestamps: list[int] = r.get("timestamp", [])
    quote = r["indicators"]["quote"][0]
    opens = quote.get("open", [])
    highs = quote.get("high", [])
    lows = quote.get("low", [])
    closes = quote.get("close", [])
    volumes = quote.get("volume", [])

    bars: list[OHLCVBar] = []
    for i, ts in enumerate(timestamps):
        o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        v = volumes[i]
        if any(x is None for x in [o, h, l, c]):
            continue
        bars.append(
            OHLCVBar(
                time=int(ts),
                open=round(float(o), 4),
                high=round(float(h), 4),
                low=round(float(l), 4),
                close=round(float(c), 4),
                volume=float(v or 0),
            )
        )
    return bars
