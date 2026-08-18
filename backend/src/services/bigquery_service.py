import json
import time
import base64
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

        # Guna js.JSON.parse untuk menghasilkan Objek JS tulen (bukan JS Map) 
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
    def __init__(self, project_id: str, access_token: str):
        raw_id = str(project_id or "etl-stock-screener-bursa")
        self.project_id = raw_id.replace('"', '').replace("'", "").replace('\n', '').replace('\r', '').strip()
        
        raw_token = str(access_token or "")
        self.access_token = raw_token.replace('"', '').replace("'", "").replace('\n', '').replace('\r', '').strip()
        
        self.endpoint = f"https://bigquery.googleapis.com/bigquery/v2/projects/{self.project_id}/queries"

    async def _execute_query(self, sql: str):
        payload = json.dumps({"query": sql, "useLegacySql": False})

        # Pembinaan JS Headers & Object yang sah untuk js.fetch
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

    async def get_subsector_ranks(self):
        return await self._execute_query("""
            SELECT date, rank, subsector_id, subsector_name, score, status, return_20d, return_5d, close_index, num_stocks
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ranks`
            ORDER BY rank ASC
        """)

    async def get_subsector_heatmap(self):
        return await self._execute_query("""
            SELECT subsector_id, subsector_name, s.sector_name as sector_name, score, return_5d, return_20d, num_stocks
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ranks` sr
            JOIN `etl-stock-screener-bursa.bursa_dataset.subsectors` s ON s.id = sr.subsector_id
        """)

    async def get_subsector_bulk_ohlc(self):
        """Ambil data OHLC dan kelompokkan mengikut subsector_id"""
        rows = await self._execute_query("""
            SELECT subsector_id, date, open, high, low, close
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ohlc`
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

    async def get_subsector_single_ohlc(self, subsector_id: int | str):
        """Ambil data sejarah OHLC untuk satu subsektor khusus berdasarkan ID"""
        query = f"""
            SELECT date, open, high, low, close
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ohlc`
            WHERE subsector_id = {int(subsector_id)}
            ORDER BY date ASC
        """
        rows = await self._execute_query(query)
        if not rows:
            return []
        return rows

    async def get_stocks_by_subsector(self, subsector_name: str = "", search: str = "", min_price: float = 0.3):
        """Ambil senarai saham mengikut subsektor, carian nama/kod, dan harga minimum"""
        where_clauses = []

        # Filter Subsektor
        if subsector_name and subsector_name not in ["All Stock", "all", ""]:
            clean_sub = subsector_name.replace("'", "\\'").strip()
            where_clauses.append(f"Scraped_Subsector LIKE '%{clean_sub}%'")

        # Filter Carian Nama / Kod Saham
        if search and search.strip():
            clean_search = search.replace("'", "\\'").strip().lower()
            where_clauses.append(
                f"(LOWER(Name) LIKE '%{clean_search}%' OR LOWER(Code) LIKE '%{clean_search}%')"
            )

        # Filter Min Price (Default: >= 0.3)
        if min_price is not None and min_price > 0:
            where_clauses.append(f"SAFE_CAST(Price AS FLOAT64) >= {min_price}")

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        rows = await self._execute_query(f"""
            SELECT DISTINCT
                REGEXP_REPLACE(TRIM(Name), r'\s+', ' ') AS Name, 
                Code, 
                Shariah, 
                SAFE_CAST(Price AS FLOAT64) AS Price, 
                SAFE_CAST(Change AS FLOAT64) AS Change, 
                -- Formatkan semula kepada nombor 2 perpuluhan bersama simbol %
                FORMAT('%.2f%%', SAFE_CAST(REPLACE(REPLACE(TRIM(Change_Percent), '%', ''), '+', '') AS FLOAT64)) AS Change_Percent, 
                SAFE_CAST(Volume AS INT64) AS Volume, 
                SAFE_CAST(MCap_M AS FLOAT64) AS MCap_M, 
                SAFE_CAST(PE AS FLOAT64) AS PE, 
                SAFE_CAST(ROE AS FLOAT64) AS ROE, 
                SAFE_CAST(DY AS FLOAT64) AS DY,
                TRIM(Scraped_Sector) AS Scraped_Sector, 
                TRIM(Scraped_Subsector) AS Scraped_Subsector
            FROM `etl-stock-screener-bursa.bursa_dataset.stocks`
            {where_sql}
            ORDER BY SAFE_CAST(REPLACE(REPLACE(Change_Percent, '%', ''), '+', '') AS FLOAT64) DESC
        """)
        return rows or []