"""Cloudflare Workers Python entry point — pure Python routing with BigQuery support."""
import os
import json
import js
from src.services.bigquery_service import BigQueryService, get_gcp_access_token
from urllib.parse import parse_qs, urlparse


def _create_headers(extra_headers: dict | None = None):
    """Pembantu untuk membina objek JS Headers yang sah dengan CORS lengkap."""
    from js import Headers  # type: ignore[import]
    
    headers = Headers.new()
    headers.set("access-control-allow-origin", "*")
    headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
    headers.set("access-control-allow-headers", "*")
    
    if extra_headers:
        for k, v in extra_headers.items():
            headers.set(k, str(v))
            
    return headers


def _load_env(env) -> None:
    mapping = {
        "SHEET_URLS": lambda: env.SHEET_URLS,
        "SHEET_LABELS": lambda: env.SHEET_LABELS,
        "GCP_SERVICE_ACCOUNT": lambda: env.GCP_SERVICE_ACCOUNT,
        "BIGQUERY_PROJECT_ID": lambda: getattr(env, "BIGQUERY_PROJECT_ID", None),
        "BIGQUERY_ACCESS_TOKEN": lambda: getattr(env, "BIGQUERY_ACCESS_TOKEN", None),
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
    from js import Response  # type: ignore[import]
    
    extra = {
        "content-type": "application/json",
    }
    if cache_seconds > 0:
        extra["cache-control"] = f"public, max-age={cache_seconds}"
    else:
        extra["cache-control"] = "no-store"
        
    headers = _create_headers(extra)
    return Response.new(json.dumps(data), status=status, headers=headers)


# def _get_bq_service(env):
#     """Inisialisasi BigQueryService menggunakan persekitaran Worker."""
#     project_id = getattr(env, "BIGQUERY_PROJECT_ID", os.environ.get("BIGQUERY_PROJECT_ID", ""))
#     access_token = getattr(env, "BIGQUERY_ACCESS_TOKEN", os.environ.get("BIGQUERY_ACCESS_TOKEN", ""))
    
#     if not project_id:
#         raise ValueError("BIGQUERY_PROJECT_ID tidak ditetapkan dalam tetapan environment.")
        
#     return BigQueryService(project_id=project_id, access_token=access_token)

from src.services.bigquery_service import BigQueryService, get_gcp_access_token

async def _get_bq_service(env):
    project_id = getattr(env, "BIGQUERY_PROJECT_ID", "etl-stock-screener-bursa")
    sa_json = getattr(env, "GCP_SERVICE_ACCOUNT_BQ", "")
    
    if not sa_json:
        raise ValueError("GCP_SERVICE_ACCOUNT tidak wujud dalam secret.")
        
    # Jana access token terkini secara automatik
    access_token = await get_gcp_access_token(sa_json)
    
    return BigQueryService(project_id=project_id, access_token=access_token)


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
            "BIGQUERY_PROJECT_ID": lambda: getattr(env, "BIGQUERY_PROJECT_ID", None),
        }
        for key, getter in tests.items():
            try:
                val = getter()
                debug[key] = f"FOUND (len={len(str(val))})" if val else "NOT SET"
            except Exception as e:
                debug[key] = f"ERROR: {type(e).__name__}: {e}"
        debug["os_SHEET_URLS"] = os.environ.get("SHEET_URLS", "NOT SET")
        debug["env_type"] = str(type(env))
        return _json(debug)

    if path == "/health":
        return _json({"status": "ok"})

    # ==============================================================================
    # SUBSECTOR ANALYSIS ENDPOINTS (BIGQUERY)
    # ==============================================================================
    if path == "/api/subsector_ranks":
        try:
            bq = await _get_bq_service(env)
            ranks = await bq.get_subsector_ranks()  # Tambah await
            return _json(ranks, cache_seconds=300)
        except Exception as e:
            return _json({"error": str(e)}, status=500)

    if path == "/api/subsector_heatmap":
        try:
            bq = await _get_bq_service(env)
            heatmap = await bq.get_subsector_heatmap()  # Tambah await
            return _json(heatmap, cache_seconds=300)
        except Exception as e:
            return _json({"error": str(e)}, status=500)

    # -------------------------------------------------------------------------
    # Route: Subsector Bulk OHLC
    # -------------------------------------------------------------------------
    if path == "/api/subsector_ohlc/bulk":
        try:
            bq = await _get_bq_service(env)
            bulk_ohlc = await bq.get_subsector_bulk_ohlc()
            return _json(bulk_ohlc or {}, cache_seconds=300)
        except Exception as e:
            return _json({"error": str(e)}, status=500)

    @app.get("/api/subsector_ohlc/{subsector_id}")
    async def get_single_subsector_chart(subsector_id: int):
    rows = await bq_service.get_subsector_single_ohlc(subsector_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Data subsektor tidak dijumpai")

    # Formatkan kepada senarai lilin standard OHLCV
    ohlcv = [
        {
            "time": r.get("date"),
            "open": float(r.get("open", 0)),
            "high": float(r.get("high", 0)),
            "low": float(r.get("low", 0)),
            "close": float(r.get("close", 0)),
            "volume": float(r.get("volume", 0) or 0)
        }
        for r in rows
    ]

    # Kira indikator teknikal (atau pulangkan {} jika tidak perlu)
    try:
        indicators = calculate_indicators(ohlcv, [5, 10, 20, 50, 100, 200])
    except Exception:
        indicators = {}

    return {
        "ticker": f"SUBSECTOR_{subsector_id}",
        "ohlcv": ohlcv,
        "indicators": indicators
    }

    # -------------------------------------------------------------------------
    # Route: Senarai Saham Mengikut Subsektor
    # -------------------------------------------------------------------------
    if path == "/api/subsector-stocks":
        try:
            parsed_url = urlparse(request.url)
            query_params = parse_qs(parsed_url.query)
            subsector_param = query_params.get("subsector", [""])[0]
            search_param = query_params.get("search", [""])[0]
            min_price_str = query_params.get("min_price", ["0.3"])[0]

            try:
                min_price_val = float(min_price_str) if min_price_str != "" else 0.0
            except ValueError:
                min_price_val = 0.3

            bq = await _get_bq_service(env)
            stocks_data = await bq.get_stocks_by_subsector(subsector_param, search_param, min_price_val)
            return _json({"stocks": stocks_data or []}, cache_seconds=60)
        except Exception as e:
            return _json({"error": str(e), "stocks": []}, status=500)

    # ==============================================================================
    # GOOGLE SHEETS & CHARTS ENDPOINTS
    # ==============================================================================
    if path == "/api/sheets":
        try:
            urls = getattr(settings, "sheet_urls", []) or []
            labels = getattr(settings, "sheet_labels", []) or []
        except Exception:
            urls, labels = [], []

        return _json({
            "sheets": [
                {"url": url, "label": label}
                for url, label in zip(urls, labels)
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
        ema_periods = [int(p) for p in ema_str.split(",") if p.strip().isdigit()] or [5, 10, 20, 50, 100, 200]
        
        return _json({
            "ticker": ticker,
            "ohlcv": bars,
            "indicators": ind.calculate_all(bars, ema_periods),
        }, cache_seconds=60)

    return _json({"error": "Not found"}, 404)


async def on_fetch(request, env):
    from js import Response  # type: ignore[import]

    if str(request.method).upper() == "OPTIONS":
        return Response.new("", status=204, headers=_create_headers())

    try:
        _load_env(env)
        return await _route(request, env)
    except Exception:
        import traceback
        return Response.new(
            json.dumps({"error": traceback.format_exc()}),
            status=500,
            headers=_create_headers({"content-type": "application/json"}),
        )