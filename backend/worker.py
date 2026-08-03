"""Cloudflare Workers Python entry point — no framework, pure Python routing."""
import os
import json


def _load_env(env) -> None:
    for key in ("SHEET_URLS", "SHEET_LABELS", "GCP_SERVICE_ACCOUNT"):
        try:
            value = getattr(env, key, None)
            if value and key not in os.environ:
                os.environ[key] = str(value)
        except Exception:
            pass


def _json(data, status=200):
    from js import Response, Headers  # type: ignore[import]
    headers = Headers.new({
        "content-type": "application/json",
        "access-control-allow-origin": "*",
    }.items())
    return Response.new(json.dumps(data), status=status, headers=headers)


async def _route(request):
    from urllib.parse import urlparse, parse_qs
    from src.config import settings

    parsed = urlparse(str(request.url))
    path = parsed.path.rstrip("/") or "/"
    params = parse_qs(parsed.query)

    def q(key, default=None):
        return params.get(key, [default])[0]

    if path == "/debug/env":
        return _json({
            "SHEET_URLS_raw": os.environ.get("SHEET_URLS", "NOT SET"),
            "SHEET_LABELS_raw": os.environ.get("SHEET_LABELS", "NOT SET"),
            "GCP_set": bool(os.environ.get("GCP_SERVICE_ACCOUNT")),
        })

    if path == "/health":
        return _json({"status": "ok"})

    if path == "/api/sheets":
        return _json({
            "sheets": [
                {"url": url, "label": label}
                for url, label in zip(settings.sheet_urls, settings.sheet_labels)
            ]
        })

    if path == "/api/worksheets":
        from src.services.sheets_service import get_worksheet_names
        sheet_url = q("sheet_url")
        if not sheet_url:
            return _json({"error": "sheet_url required"}, 400)
        sa = settings.gcp_service_account
        if not sa:
            return _json({"error": "GCP credentials not configured"}, 503)
        names = await get_worksheet_names(sheet_url, sa)
        return _json({"worksheets": names})

    if path == "/api/stocks":
        from src.services.sheets_service import get_stock_list
        sheet_url = q("sheet_url")
        worksheet = q("worksheet", "Stock_List")
        if not sheet_url:
            return _json({"error": "sheet_url required"}, 400)
        sa = settings.gcp_service_account
        if not sa:
            return _json({"error": "GCP credentials not configured"}, 503)
        stocks = await get_stock_list(sheet_url, worksheet, sa)
        return _json({"stocks": stocks})

    if path == "/api/chart":
        from src.services import yahoo_service
        from src.services import indicators as ind
        ticker = q("ticker")
        if not ticker:
            return _json({"error": "ticker required"}, 400)
        period = q("period", "1y")
        interval = q("interval", "1d")
        ema_str = q("ema_periods", "10,20,50")
        bars = await yahoo_service.fetch_ohlcv(ticker, period, interval)
        if not bars:
            return _json({"error": f"No data for '{ticker}'"}, 404)
        ema_periods = [int(p) for p in ema_str.split(",") if p.strip().isdigit()] or [10, 20, 50]
        return _json({
            "ticker": ticker,
            "ohlcv": bars,
            "indicators": ind.calculate_all(bars, ema_periods),
        })

    return _json({"error": "Not found"}, 404)


async def on_fetch(request, env):
    try:
        _load_env(env)
        return await _route(request)
    except Exception:
        import traceback
        from js import Response  # type: ignore[import]
        return Response.new(f"Error:\n{traceback.format_exc()}", status=500)
