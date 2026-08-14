import json
import time
import base64
from js import fetch, crypto, Uint8Array
from pyodide.ffi import to_js


async def get_gcp_access_token(sa_json_str: str) -> str:
    """Tukar GCP Service Account JSON kepada Access Token yang sah secara dinamik."""
    try:
        sa_data = json.loads(sa_json_str)
        client_email = sa_data["client_email"]
        private_key_pem = sa_data["private_key"]

        # 1. Bina Header & Payload JWT
        now = int(time.time())
        header = {"alg": "RS256", "typ": "JWT"}
        payload = {
            "iss": client_email,
            "scope": "https://www.googleapis.com/auth/bigquery",
            "aud": "https://oauth2.googleapis.com/token",
            "exp": now + 3600,
            "iat": now,
        }

        def b64url(data_bytes):
            return base64.urlsafe_b64encode(data_bytes).decode("utf-8").rstrip("=")

        header_b64 = b64url(json.dumps(header).encode("utf-8"))
        payload_b64 = b64url(json.dumps(payload).encode("utf-8"))
        unsigned_token = f"{header_b64}.{payload_b64}"

        # 2. Extract Private Key DER
        pem_body = (
            private_key_pem.replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replace("\n", "")
            .strip()
        )
        key_der = base64.b64decode(pem_body)

        js_key_buffer = Uint8Array.new(len(key_der))
        for i, b in enumerate(key_der):
            js_key_buffer[i] = b

        key_algorithm = to_js({"name": "RSASSA-PKCS1-v1_5", "hash": {"name": "SHA-256"}})

        imported_key = await crypto.subtle.importKey(
            "pkcs8", js_key_buffer.buffer, key_algorithm, False, to_js(["sign"])
        )

        # 3. Sign JWT guna Web Crypto API
        token_bytes = unsigned_token.encode("utf-8")
        js_data_buffer = Uint8Array.new(len(token_bytes))
        for i, b in enumerate(token_bytes):
            js_data_buffer[i] = b

        signature_buffer = await crypto.subtle.sign(
            key_algorithm, imported_key, js_data_buffer.buffer
        )

        sig_bytes = bytes(Uint8Array.new(signature_buffer))
        jwt_signed = f"{unsigned_token}.{b64url(sig_bytes)}"

        # 4. Minta Access Token dari Google OAuth2
        body_params = f"grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={jwt_signed}"

        opts = to_js(
            {
                "method": "POST",
                "headers": {"Content-Type": "application/x-www-form-urlencoded"},
                "body": body_params,
            }
        )

        res = await fetch("https://oauth2.googleapis.com/token", opts)
        text_res = await res.text()
        data = json.loads(text_res)

        if "access_token" in data:
            return data["access_token"]
        raise Exception(f"Google OAuth Failed: {text_res}")

    except Exception as e:
        raise Exception(f"Gagal menjana GCP Access Token: {str(e)}")


class BigQueryService:
    def __init__(self, project_id: str, access_token: str):
        # Clean sebarang spaces, quotes, newlines atau carriage returns
        raw_id = str(project_id or "etl-stock-screener-bursa")
        self.project_id = raw_id.replace('"', '').replace("'", "").replace('\n', '').replace('\r', '').strip()
        
        raw_token = str(access_token or "")
        self.access_token = raw_token.replace('"', '').replace("'", "").replace('\n', '').replace('\r', '').strip()
        
        self.endpoint = f"https://bigquery.googleapis.com/bigquery/v2/projects/{self.project_id}/queries"

    async def _execute_query(self, sql: str):
        payload = json.dumps({"query": sql, "useLegacySql": False})

        init_opts = {
            "method": "POST",
            "headers": {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
            },
            "body": payload,
        }

        try:
            response = await fetch(self.endpoint, to_js(init_opts))
            text_data = await response.text()
        except Exception as e:
            raise Exception(f"Ralat sambungan ke {self.endpoint}: {str(e)}")

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            # Memaparkan URL endpoint untuk memudahkan pengesahan jika timbul 404
            raise Exception(
                f"URL: [{self.endpoint}] | Status: HTTP {response.status} | Output: {text_data[:200]}"
            )

        if response.status != 200:
            error_msg = data.get("error", {}).get("message", text_data)
            raise Exception(
                f"BigQuery API Error (HTTP {response.status}): {error_msg}"
            )

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
            SELECT subsector_id, subsector_name, sector_name, score, return_5d, return_20d, num_stocks
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_heatmap`
        """)

    async def get_subsector_bulk_ohlc(self):
        raw_rows = await self._execute_query("""
            SELECT subsector_id, date, open, high, low, close
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ohlc`
            ORDER BY date ASC
        """)

        result = {}
        for row in raw_rows:
            sub_id = row.get("subsector_id")
            if sub_id is not None:
                if sub_id not in result:
                    result[sub_id] = []
                result[sub_id].append(row)
        return result