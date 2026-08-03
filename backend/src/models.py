from pydantic import BaseModel


class SheetEntry(BaseModel):
    url: str
    label: str


class Stock(BaseModel):
    name: str
    ticker: str


class OHLCVBar(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class IndicatorData(BaseModel):
    ema: dict[str, list[float | None]]
    rsi: list[float | None]
    macd: list[float | None]
    macd_signal: list[float | None]
    macd_histogram: list[float | None]
    cvd: list[float]
    cmf: list[float | None]


class ChartResponse(BaseModel):
    ticker: str
    ohlcv: list[OHLCVBar]
    indicators: IndicatorData
