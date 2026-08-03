from fastapi import APIRouter, HTTPException, Query
from ..services import yahoo_service
from ..services import indicators as ind

router = APIRouter()


@router.get("/chart")
async def get_chart(
    ticker: str = Query(..., description="Yahoo Finance ticker, e.g. 1155.KL or AAPL"),
    period: str = Query("1y", description="Data range: 3mo|6mo|1y|2y|5y|max"),
    interval: str = Query("1d", description="Bar interval: 1d|1wk|1mo"),
    ema_periods: str = Query("10,20,50", description="Comma-separated EMA periods"),
):
    """Return OHLCV bars + all technical indicators for a ticker."""
    try:
        bars = await yahoo_service.fetch_ohlcv(ticker, period, interval)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Yahoo Finance error: {exc}") from exc

    if not bars:
        raise HTTPException(status_code=404, detail=f"No data for ticker '{ticker}'")

    periods = [
        int(p) for p in ema_periods.split(",") if p.strip().isdigit()
    ] or [10, 20, 50]

    bar_dicts = [b.model_dump() for b in bars]
    indicators = ind.calculate_all(bar_dicts, periods)

    return {
        "ticker": ticker,
        "ohlcv": bar_dicts,
        "indicators": indicators,
    }
