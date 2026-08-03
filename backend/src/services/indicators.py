"""Technical indicator calculations — pure Python, no numpy."""
from math import isnan, nan


def _clean(vals: list) -> list[float]:
    return [float(v) if v is not None else nan for v in vals]


def _nan_list(arr: list) -> list:
    return [None if (v != v) else round(v, 4) for v in arr]  # v!=v is nan check


def calc_ema(values: list[float], period: int) -> list[float]:
    n = len(values)
    result = [nan] * n
    if n < period:
        return result
    valid = [v for v in values[:period] if v == v]
    if len(valid) < period:
        return result
    k = 2.0 / (period + 1)
    result[period - 1] = sum(values[:period]) / period
    for i in range(period, n):
        if values[i] == values[i]:
            result[i] = values[i] * k + result[i - 1] * (1 - k)
        else:
            result[i] = result[i - 1]
    return result


def calc_rsi(closes: list[float], period: int = 14) -> list[float]:
    n = len(closes)
    result = [nan] * n
    if n <= period:
        return result
    gains, losses = [], []
    for i in range(1, n):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0.0))
        losses.append(max(-d, 0.0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, n):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        if avg_loss == 0:
            result[i] = 100.0
        else:
            result[i] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    return result


def calc_macd(closes: list[float], fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)
    macd = [f - s if (f == f and s == s) else nan for f, s in zip(ema_fast, ema_slow)]

    # Signal line: EMA of macd starting from first non-nan
    signal_line = [nan] * len(macd)
    start = next((i for i, v in enumerate(macd) if v == v), None)
    if start is not None:
        seg = calc_ema(macd[start:], signal)
        for i, v in enumerate(seg):
            signal_line[start + i] = v

    hist = [m - s if (m == m and s == s) else nan for m, s in zip(macd, signal_line)]
    return macd, signal_line, hist


def calc_cvd(opens: list[float], closes: list[float], volumes: list[float]) -> list[float]:
    cvd, total = [], 0.0
    for o, c, v in zip(opens, closes, volumes):
        total += v if c > o else (-v if c < o else 0.0)
        cvd.append(total)
    return cvd


def calc_cmf(highs, lows, closes, volumes, period: int = 20) -> list[float]:
    n = len(closes)
    result = [nan] * n
    for i in range(period - 1, n):
        vol_sum = sum(volumes[i - period + 1:i + 1])
        if vol_sum == 0:
            result[i] = 0.0
            continue
        mfv_sum = 0.0
        for j in range(i - period + 1, i + 1):
            hl = highs[j] - lows[j]
            mfm = ((closes[j] - lows[j]) - (highs[j] - closes[j])) / hl if hl != 0 else 0.0
            mfv_sum += mfm * volumes[j]
        result[i] = mfv_sum / vol_sum
    return result


def calculate_all(bars: list[dict], ema_periods: list[int] | None = None) -> dict:
    if not bars:
        return {}
    if ema_periods is None:
        ema_periods = [10, 20, 50]

    opens  = _clean([b["open"]   for b in bars])
    highs  = _clean([b["high"]   for b in bars])
    lows   = _clean([b["low"]    for b in bars])
    closes = _clean([b["close"]  for b in bars])
    vols   = _clean([b["volume"] for b in bars])

    macd, sig, hist = calc_macd(closes)

    return {
        "ema":           {str(p): _nan_list(calc_ema(closes, p)) for p in ema_periods},
        "rsi":           _nan_list(calc_rsi(closes)),
        "macd":          _nan_list(macd),
        "macd_signal":   _nan_list(sig),
        "macd_histogram":_nan_list(hist),
        "cvd":           [round(v, 2) for v in calc_cvd(opens, closes, vols)],
        "cmf":           _nan_list(calc_cmf(highs, lows, closes, vols)),
    }
