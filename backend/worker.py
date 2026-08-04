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


def _clean_url(raw_url: str | None) -> str | None:
    """Bersihkan sheet_url jika ia dikirim sebagai JSON string array dari frontend."""
    if not raw_url:
        return None
    raw_url = raw_url.strip()
    if raw_url.startswith("["):
        try:
            parsed = json.loads(raw_url)
            if isinstance(parsed, list) and len(parsed) > 0:
                return str(parsed[0]).strip()
        except Exception:
            pass
    return raw_url


def _json(data, status=200, cache_seconds=0):
    from js import Response, Headers  # type: ignore[import]
    
    headers_dict = {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
    }
    
    if cache_seconds > 0:
        headers_dict["cache-control"] = f"public, max-age={cache_seconds}"
    else:
        headers_dict["cache-control"] = "no-store"
        
    headers = Headers.new(headers_dict.items())
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
        sheet_url = _clean_url(q("sheet_url"))
        if not sheet_url:
            return _json({"error": "sheet_url required"}, 400)
        sa = settings.gcp_service_account
        if not sa:
            return _json({"error": "GCP credentials not configured"}, 503)
        names = await get_worksheet_names(sheet_url, sa)
        return _json({"worksheets": names})

    if path == "/api/stocks":
        from src.services.sheets_service import get_stock_list, get_worksheet_names
        sheet_url = _clean_url(q("sheet_url"))
        worksheet = q("worksheet")
        if not sheet_url:
            return _json({"error": "sheet_url required"}, 400)
        sa = settings.gcp_service_account
        if not sa:
            return _json({"error": "GCP credentials not configured"}, 503)

        try:
            stocks = await get_stock_list(sheet_url, worksheet or "Sheet1", sa)
        except Exception as e:
            # Fallback ke tab pertama sekiranya nama worksheet asal tiada
            all_sheets = await get_worksheet_names(sheet_url, sa)
            if all_sheets:
                stocks = await get_stock_list(sheet_url, all_sheets[0], sa)
            else:
                raise e

        return _json({"stocks": stocks})

    if path == "/api/table":
        from src.services.sheets_service import get_table_data
        sheet_url = _clean_url(q("sheet_url"))
        worksheet = q("worksheet", "Sheet1")
        if not sheet_url:
            return _json({"error": "sheet_url required"}, 400)
        sa = settings.gcp_service_account
        if not sa:
            return _json({"error": "GCP credentials not configured"}, 503)
        table = await get_table_data(sheet_url, worksheet, sa)
        return _json(table)

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
        
        # Tambah cache selama 60 saat untuk tingkatkan kelajuan muatan carta
        return _json({
            "ticker": ticker,
            "ohlcv": bars,
            "indicators": ind.calculate_all(bars, ema_periods),
        }, cache_seconds=60)

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