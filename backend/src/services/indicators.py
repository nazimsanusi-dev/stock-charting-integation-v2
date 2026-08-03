"""Technical indicator calculations using numpy (no pandas-ta dependency)."""
import numpy as np


def _nan_list(arr: np.ndarray) -> list:
    return [None if np.isnan(x) else round(float(x), 4) for x in arr]


def calc_ema(values: np.ndarray, period: int) -> np.ndarray:
    result = np.full(len(values), np.nan)
    if len(values) < period:
        return result
    k = 2.0 / (period + 1)
    result[period - 1] = float(np.mean(values[:period]))
    for i in range(period, len(values)):
        result[i] = values[i] * k + result[i - 1] * (1 - k)
    return result


def calc_rsi(closes: np.ndarray, period: int = 14) -> np.ndarray:
    result = np.full(len(closes), np.nan)
    if len(closes) <= period:
        return result
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = float(np.mean(gains[:period]))
    avg_loss = float(np.mean(losses[:period]))
    for i in range(period, len(closes)):
        idx = i - 1
        avg_gain = (avg_gain * (period - 1) + gains[idx]) / period
        avg_loss = (avg_loss * (period - 1) + losses[idx]) / period
        if avg_loss == 0:
            result[i] = 100.0
        else:
            result[i] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    return result


def calc_macd(
    closes: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)
    macd_line = ema_fast - ema_slow

    signal_line = np.full(len(macd_line), np.nan)
    valid_idx = np.where(~np.isnan(macd_line))[0]
    if len(valid_idx) >= signal:
        start = valid_idx[0]
        sig = calc_ema(macd_line[start:], signal)
        signal_line[start:] = sig

    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calc_cvd(opens: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    """Approximate CVD using candle direction × volume."""
    delta = np.where(closes > opens, volumes, np.where(closes < opens, -volumes, 0.0))
    return np.cumsum(delta)


def calc_cmf(
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    volumes: np.ndarray,
    period: int = 20,
) -> np.ndarray:
    hl = highs - lows
    mfm = np.where(hl != 0, ((closes - lows) - (highs - closes)) / hl, 0.0)
    mfv = mfm * volumes
    result = np.full(len(closes), np.nan)
    for i in range(period - 1, len(closes)):
        vol_sum = float(np.sum(volumes[i - period + 1 : i + 1]))
        result[i] = float(np.sum(mfv[i - period + 1 : i + 1])) / vol_sum if vol_sum else 0.0
    return result


def calculate_all(
    bars: list[dict],
    ema_periods: list[int] | None = None,
) -> dict:
    if not bars:
        return {}
    if ema_periods is None:
        ema_periods = [10, 20, 50]

    opens = np.array([b["open"] for b in bars], dtype=float)
    highs = np.array([b["high"] for b in bars], dtype=float)
    lows = np.array([b["low"] for b in bars], dtype=float)
    closes = np.array([b["close"] for b in bars], dtype=float)
    volumes = np.array([b["volume"] for b in bars], dtype=float)

    macd, sig, hist = calc_macd(closes)

    return {
        "ema": {str(p): _nan_list(calc_ema(closes, p)) for p in ema_periods},
        "rsi": _nan_list(calc_rsi(closes)),
        "macd": _nan_list(macd),
        "macd_signal": _nan_list(sig),
        "macd_histogram": _nan_list(hist),
        "cvd": [round(float(x), 2) for x in calc_cvd(opens, closes, volumes)],
        "cmf": _nan_list(calc_cmf(highs, lows, closes, volumes)),
    }
