"""Cloudflare Workers Python entry point — no framework, pure Python routing."""
import os
import json


def _load_env(env) -> None:
    mapping = {
        "SHEET_URLS": lambda: env.SHEET_URLS,
        "SHEET_LABELS": lambda: env.SHEET_LABELS,
        "GCP_SERVICE_ACCOUNT": lambda: env.GCP_SERVICE_ACCOUNT,
    }
    for key, getter in mapping.items():
        try:
            if key not in os.environ:
                value = getter()
                if value is not None:
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


async def _route(request, env):
    from urllib.parse import urlparse, parse_qs
    from src.config import settings

    parsed = urlparse(str(request.url))
    path = parsed.path.rstrip("/") or "/"
    params = parse_qs(parsed.query)

    def q(key, default=None):
        return params.get(key, [default])[0]

    if path == "/debug/env":
        debug = {}
        tests = {
            "SHEET_URLS": lambda: env.SHEET_URLS,
            "SHEET_LABELS": lambda: env.SHEET_LABELS,
            "GCP_SERVICE_ACCOUNT": lambda: env.GCP_SERVICE_ACCOUNT,
        }
        for key, getter in tests.items():
            try:
                val = getter()
                debug[key] = f"FOUND (len={len(str(val))})"
            except Exception as e:
                debug[key] = f"ERROR: {type(e).__name__}: {e}"
        debug["os_SHEET_URLS"] = os.environ.get("SHEET_URLS", "NOT SET")
        debug["env_type"] = str(type(env))
        return _json(debug)

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
            from src.services.sheets_service import get_stock_list, get_worksheet_names
            sheet_url = q("sheet_url")
            worksheet = q("worksheet")
            if not sheet_url:
                return _json({"error": "sheet_url required"}, 400)
            sa = settings.gcp_service_account
            if not sa:
                return _json({"error": "GCP credentials not configured"}, 503)

            # Jika tiada worksheet diberi atau ingin elak error tab tak wujud:
            try:
                stocks = await get_stock_list(sheet_url, worksheet or "Sheet1", sa)
            except Exception as e:
                # Jika tab spesifik gagal, ambil tab pertama secara automatik
                all_sheets = await get_worksheet_names(sheet_url, sa)
                if all_sheets:
                    stocks = await get_stock_list(sheet_url, all_sheets[0], sa)
                else:
                    raise e

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
    from js import Response, Headers  # type: ignore[import]
    cors_headers = Headers.new({
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*",
    }.items())

    if str(request.method).upper() == "OPTIONS":
        return Response.new("", status=204, headers=cors_headers)

    try:
        _load_env(env)
        return await _route(request, env)
    except Exception:
        import traceback
        return Response.new(
            json.dumps({"error": traceback.format_exc()}),
            status=500,
            headers=cors_headers,
        )
