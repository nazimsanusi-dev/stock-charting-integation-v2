import json
import time
import base64
import uuid
from datetime import datetime, timezone
import js
from js import fetch, Object, Headers
from pyodide.ffi import to_js

async def get_gcp_access_token(sa_json_str: str) -> str:
    """Tukar GCP Service Account JSON kepada Access Token Google secara automatik."""
    try:
        sa_data = json.loads(sa_json_str.strip())
        client_email = sa_data["client_email"]
        private_key_pem = sa_data["private_key"]

        # 1. Bina Header & Claim JWT
        now = int(time.time())
        header = {"alg": "RS256", "typ": "JWT"}
        payload = {
            "iss": client_email,
            "scope": "https://www.googleapis.com/auth/bigquery",
            "aud": "https://oauth2.googleapis.com/token",
            "exp": now + 3600,
            "iat": now,
        }

        def b64url(data_bytes: bytes) -> str:
            return (
                base64.urlsafe_b64encode(data_bytes).decode("utf-8").rstrip("=")
            )

        header_b64 = b64url(json.dumps(header).encode("utf-8"))
        payload_b64 = b64url(json.dumps(payload).encode("utf-8"))
        unsigned_token = f"{header_b64}.{payload_b64}"

        # 2. Parse Private Key DER
        pem_body = (
            private_key_pem.replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replace("\n", "")
            .replace("\r", "")
            .strip()
        )
        key_der = base64.b64decode(pem_body)

        js_key_buf = js.Uint8Array.new(len(key_der))
        for i, b in enumerate(key_der):
            js_key_buf[i] = b

        # Guna js.JSON.parse untuk menghasilkan Objek JS tulen
        key_algorithm = js.JSON.parse(
            json.dumps(
                {"name": "RSASSA-PKCS1-v1_5", "hash": {"name": "SHA-256"}}
            )
        )
        key_usages = js.JSON.parse(json.dumps(["sign"]))

        imported_key = await js.crypto.subtle.importKey(
            "pkcs8", js_key_buf.buffer, key_algorithm, False, key_usages
        )

        # 3. Sign JWT guna Web Crypto
        token_bytes = unsigned_token.encode("utf-8")
        js_data_buf = js.Uint8Array.new(len(token_bytes))
        for i, b in enumerate(token_bytes):
            js_data_buf[i] = b

        sig_buffer = await js.crypto.subtle.sign(
            key_algorithm, imported_key, js_data_buf.buffer
        )

        sig_bytes = bytes(js.Uint8Array.new(sig_buffer))
        jwt_signed = f"{unsigned_token}.{b64url(sig_bytes)}"

        # 4. Request Access Token dari Google OAuth2
        headers = js.Headers.new()
        headers.set("Content-Type", "application/x-www-form-urlencoded")

        body_params = f"grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={jwt_signed}"

        fetch_opts = js.Object.new()
        fetch_opts.method = "POST"
        fetch_opts.headers = headers
        fetch_opts.body = body_params

        res = await js.fetch("https://oauth2.googleapis.com/token", fetch_opts)
        text_res = await res.text()
        data = json.loads(text_res)

        if "access_token" in data:
            return data["access_token"]
        raise Exception(f"Google OAuth Error: {text_res}")

    except Exception as e:
        raise Exception(f"Gagal menjana GCP Access Token: {str(e)}")


class BigQueryService:
    def __init__(self, project_id: str, access_token: str, dataset_id: str = "bursa_dataset"):
        raw_id = str(project_id or "etl-stock-screener-bursa")
        self.project_id = raw_id.replace('"', '').replace("'", "").replace('\n', '').replace('\r', '').strip()
        
        raw_token = str(access_token or "")
        self.access_token = raw_token.replace('"', '').replace("'", "").replace('\n', '').replace('\r', '').strip()
        
        self.dataset_id = dataset_id
        self.endpoint = f"https://bigquery.googleapis.com/bigquery/v2/projects/{self.project_id}/queries"
        self.insert_endpoint = f"https://bigquery.googleapis.com/bigquery/v2/projects/{self.project_id}/datasets/{self.dataset_id}/tables/stock_monitoring/insertAll"
        

    async def _execute_query(self, sql: str):
        payload = json.dumps({"query": sql, "useLegacySql": False})

        headers = Headers.new()
        headers.set("Authorization", f"Bearer {self.access_token}")
        headers.set("Content-Type", "application/json")

        fetch_opts = Object.new()
        fetch_opts.method = "POST"
        fetch_opts.headers = headers
        fetch_opts.body = payload

        try:
            response = await fetch(self.endpoint, fetch_opts)
            text_data = await response.text()
        except Exception as e:
            raise Exception(f"Ralat sambungan: {str(e)}")

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            raise Exception(f"Status: HTTP {response.status} | Output: {text_data[:200]}")

        if response.status != 200:
            error_msg = data.get("error", {}).get("message", text_data)
            raise Exception(f"BigQuery Error (HTTP {response.status}): {error_msg}")

        if "rows" not in data or "schema" not in data:
            return []

        fields = [f["name"] for f in data["schema"]["fields"]]
        rows = []
        for r in data["rows"]:
            row_dict = {fields[i]: cell["v"] for i, cell in enumerate(r["f"])}
            rows.append(row_dict)
        return rows

    async def get_subsector_ranks(self, market: str = "MY"):
        table = (
            "etl-stock-screener-bursa.us_stocks_data.us_subsector_ranks"
            if market.upper() == "US"
            else "etl-stock-screener-bursa.bursa_dataset.subsector_ranks"
        )

        return await self._execute_query(f"""
            SELECT date, rank, subsector_id, subsector_name, score, status, return_20d, return_5d, close_index, num_stocks
            FROM `{table}`
            ORDER BY rank ASC
        """)

    async def get_subsector_heatmap(self, market: str = "MY"):
        if market.upper() == "US":
            # US data: sector terus diambil dari jadual shariah_stocks
            return await self._execute_query("""
                SELECT 
                    sr.subsector_id, 
                    sr.subsector_name, 
                    COALESCE(s.sector, 'General') as sector_name, 
                    sr.score, 
                    sr.return_5d, 
                    sr.return_20d, 
                    sr.num_stocks
                FROM `etl-stock-screener-bursa.us_stocks_data.us_subsector_ranks` sr
                LEFT JOIN (
                    SELECT DISTINCT industry, sector 
                    FROM `etl-stock-screener-bursa.us_stocks_data.shariah_stocks`
                ) s ON s.industry = sr.subsector_name
            """)
        else:
            # Bursa data
            return await self._execute_query("""
                SELECT subsector_id, subsector_name, s.sector_name as sector_name, score, return_5d, return_20d, num_stocks
                FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ranks` sr
                JOIN `etl-stock-screener-bursa.bursa_dataset.subsectors` s ON s.id = sr.subsector_id
            """)

    async def get_subsector_bulk_ohlc(self, market: str = "MY"):
        table = (
            "etl-stock-screener-bursa.us_stocks_data.us_subsector_ohlc"
            if market.upper() == "US"
            else "etl-stock-screener-bursa.bursa_dataset.subsector_ohlc"
        )

        rows = await self._execute_query(f"""
            SELECT subsector_id, date, open, high, low, close
            FROM `{table}`
            ORDER BY date ASC
        """)
        if not rows:
            return {}

        grouped = {}
        for r in rows:
            sid = str(r.get("subsector_id"))
            if sid not in grouped:
                grouped[sid] = []
            grouped[sid].append(r)
        return grouped

    async def get_subsector_single_ohlc(
        self, subsector_id: int | str, market: str = "MY"
    ):
        table = (
            "etl-stock-screener-bursa.us_stocks_data.us_subsector_ohlc"
            if market.upper() == "US"
            else "etl-stock-screener-bursa.bursa_dataset.subsector_ohlc"
        )

        query = f"""
            SELECT date, open, high, low, close
            FROM `{table}`
            WHERE subsector_id = {int(subsector_id)}
            ORDER BY date ASC
        """
        rows = await self._execute_query(query)
        if not rows:
            return []
        return rows

    async def get_stocks_by_subsector(
        self,
        subsector_name: str = "",
        search: str = "",
        min_price: float = 0.3,
        market: str = "MY",
        ema_bullish: bool = False,
    ):
        where_clauses = []

        if market.upper() == "US":
            join_sql = (
                "INNER JOIN `etl-stock-screener-bursa.us_stocks_data.ema_bullish_detector` ema ON TRIM(s.id) = TRIM(ema.id)"
                if ema_bullish
                else ""
            )

            if subsector_name and subsector_name not in ["All Stock", "all", ""]:
                clean_sub = subsector_name.replace("'", "\\'").strip()
                where_clauses.append(f"s.industry = '{clean_sub}'")

            if search and search.strip():
                clean_search = search.replace("'", "\\'").strip().lower()
                where_clauses.append(
                    f"(LOWER(s.name) LIKE '%{clean_search}%' OR LOWER(s.id) LIKE '%{clean_search}%')"
                )

            if min_price is not None and min_price > 0:
                where_clauses.append(
                    f"SAFE_CAST(s.currentPrice AS FLOAT64) >= {min_price}"
                )

            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            query = f"""
                SELECT DISTINCT
                    TRIM(s.name) AS Name, 
                    s.id AS Code, 
                    'Yes' AS Shariah, 
                    SAFE_CAST(s.currentPrice AS FLOAT64) AS Price, 
                    0.0 AS Change, 
                    '0.00%' AS Change_Percent, 
                    0 AS Volume, 
                    ROUND(SAFE_CAST(s.marketCapitalization AS FLOAT64) / 1000000, 2) AS MCap_M, 
                    NULL AS PE, 
                    NULL AS ROE, 
                    NULL AS DY,
                    TRIM(s.sector) AS Scraped_Sector, 
                    TRIM(s.industry) AS Scraped_Subsector,
                    s.marketCapClassification,
                    s.analyst_recommendation_weighted_avg AS recommendation
                FROM `etl-stock-screener-bursa.us_stocks_data.shariah_stocks` s
                {join_sql}
                {where_sql}
                ORDER BY Price DESC
            """
        else:
            join_sql = (
                "INNER JOIN `etl-stock-screener-bursa.bursa_dataset.ema_bullish_detector` ema ON TRIM(CAST(s.Code AS STRING)) = TRIM(CAST(ema.code AS STRING))"
                if ema_bullish
                else ""
            )

            if subsector_name and subsector_name not in ["All Stock", "all", ""]:
                clean_sub = subsector_name.replace("'", "\\'").strip()
                where_clauses.append(f"s.Scraped_Subsector LIKE '%{clean_sub}%'")

            if search and search.strip():
                clean_search = search.replace("'", "\\'").strip().lower()
                where_clauses.append(
                    f"(LOWER(s.Name) LIKE '%{clean_search}%' OR LOWER(s.Code) LIKE '%{clean_search}%')"
                )

            if min_price is not None and min_price > 0:
                where_clauses.append(
                    f"SAFE_CAST(s.Price AS FLOAT64) >= {min_price}"
                )

            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            query = f"""
                SELECT DISTINCT
                    REGEXP_REPLACE(TRIM(s.Name), r'\\s+', ' ') AS Name, 
                    s.Code, 
                    s.Shariah, 
                    SAFE_CAST(s.Price AS FLOAT64) AS Price, 
                    SAFE_CAST(s.Change AS FLOAT64) AS Change, 
                    FORMAT('%.2f%%', SAFE_CAST(REPLACE(REPLACE(TRIM(s.Change_Percent), '%', ''), '+', '') AS FLOAT64)) AS Change_Percent, 
                    SAFE_CAST(s.Volume AS INT64) AS Volume, 
                    SAFE_CAST(s.MCap_M AS FLOAT64) AS MCap_M, 
                    SAFE_CAST(s.PE AS FLOAT64) AS PE, 
                    SAFE_CAST(s.ROE AS FLOAT64) AS ROE, 
                    SAFE_CAST(s.DY AS FLOAT64) AS DY,
                    TRIM(s.Scraped_Sector) AS Scraped_Sector, 
                    TRIM(s.Scraped_Subsector) AS Scraped_Subsector
                FROM `etl-stock-screener-bursa.bursa_dataset.stocks` s
                {join_sql}
                {where_sql}
                ORDER BY SAFE_CAST(REPLACE(REPLACE(s.Change_Percent, '%', ''), '+', '') AS FLOAT64) DESC
            """

        rows = await self._execute_query(query)
        return rows or []

    async def insert_stock_monitoring(self, payload: dict) -> dict:
        """Streaming Insert ke dalam BigQuery table stock_monitoring menggunakan REST API."""
        raw_code = str(payload.get("code", "")).strip()
        symbol = raw_code if raw_code.endswith(".KL") else f"{raw_code}.KL"
        name = str(payload.get("name", raw_code)).strip()

        raw_price = str(payload.get("price", "0")).replace(",", "").replace("RM", "").strip()
        try:
            insert_price = round(float(raw_price), 3)
        except ValueError:
            insert_price = 0.0

        tp_price = round(insert_price * 1.06, 3)
        sl_price = round(insert_price * 0.98, 3)
        now_iso = datetime.now(timezone.utc).isoformat()

        row_data = {
            "id": f"mon_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}",
            "source_table": payload.get("source_table", "Subsector Analysis"),
            "name": name,
            "symbol": symbol,
            "insert_price": insert_price,
            "current_price": insert_price,
            "highest_price": insert_price,
            "lowest_price": insert_price,
            "tp_price": tp_price,
            "sl_price": sl_price,
            "pnl_percent": 0.0,
            "sector": payload.get("sector", "-"),
            "subsector": payload.get("subsector", "-"),
            "status": "MONITORING",
            "is_active": True,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        body = {
            "rows": [
                {
                    "insertId": row_data["id"],
                    "json": row_data
                }
            ]
        }

        headers = Headers.new()
        headers.set("Authorization", f"Bearer {self.access_token}")
        headers.set("Content-Type", "application/json")

        fetch_opts = Object.new()
        fetch_opts.method = "POST"
        fetch_opts.headers = headers
        fetch_opts.body = json.dumps(body)

        try:
            res = await fetch(self.insert_endpoint, fetch_opts)
            text_res = await res.text()
            res_json = json.loads(text_res)
        except Exception as e:
            raise Exception(f"Ralat sambungan Insert: {str(e)}")

        if res.status != 200:
            err_msg = res_json.get("error", {}).get("message", text_res)
            raise Exception(f"BigQuery Insert Error (HTTP {res.status}): {err_msg}")

        if res_json.get("insertErrors"):
            raise Exception(f"BigQuery Insert Errors: {res_json.get('insertErrors')}")

        return row_data

    async def get_monitoring_table_data(self):
        """Ambil data stock_monitoring dalam format sedia untuk TableView UI."""
        query = f"""
            SELECT 
                name AS Name,
                symbol AS Symbol,
                insert_price AS Insert_Price,
                current_price AS Price,
                tp_price AS TP_Price,
                sl_price AS SL_Price,
                FORMAT('%.2f%%', pnl_percent) AS PnL,
                status AS Status,
                sector AS Sector,
                subsector AS Subsector,
                source_table AS Source,
                FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', created_at) AS Insert_Date
            FROM `{self.project_id}.{self.dataset_id}.stock_monitoring`
            WHERE is_active = TRUE
            ORDER BY created_at DESC
        """
        rows = await self._execute_query(query)
        if not rows:
            return {
                "headers": ["Name", "Symbol", "Insert_Price", "Price", "TP_Price", "SL_Price", "PnL", "Status", "Sector", "Subsector", "Source", "Insert_Date"],
                "rows": []
            }

        headers = list(rows[0].keys())
        table_rows = [[str(r.get(h, "")) for h in headers] for r in rows]

        return {"headers": headers, "rows": table_rows}