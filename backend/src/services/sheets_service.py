"""Google Sheets REST API — uses Workers native fetch + Web Crypto API for JWT."""
import base64
import json
import time
from urllib.parse import quote, urlencode
from pyodide.ffi import to_js  # type: ignore[import]

_SCOPES = (
    "https://www.googleapis.com/auth/spreadsheets.readonly "
    "https://www.googleapis.com/auth/drive.readonly"
)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


async def _make_jwt(payload: dict, private_key_pem: str) -> str:
    from js import crypto, Uint8Array, Object  # type: ignore[import]

    header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}"

    # Parse PEM → DER bytes
    pem_lines = [l for l in private_key_pem.strip().split("\n") if not l.startswith("-----")]
    key_der = base64.b64decode("".join(pem_lines))

    # Build Web Crypto algorithm descriptor
    algo = Object.new()
    algo.name = "RSASSA-PKCS1-v1_5"
    algo.hash = "SHA-256"

    # Import PKCS#8 private key
    key_view = Uint8Array.new(key_der)
    key_usages = to_js(["sign"])  # Convert Python list to native JS Array

    crypto_key = await crypto.subtle.importKey("pkcs8", key_view, algo, False, key_usages)

    # Sign
    msg_view = Uint8Array.new(signing_input.encode())
    sig_buffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", crypto_key, msg_view)
    sig_bytes = bytes(Uint8Array.new(sig_buffer))

    return f"{header}.{body}.{_b64url(sig_bytes)}"


async def _get_access_token(sa: dict) -> str:
    from js import fetch, Headers  # type: ignore[import]

    now = int(time.time())
    token = await _make_jwt({
        "iss": sa["client_email"],
        "scope": _SCOPES,
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }, sa["private_key"])

    body = urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": token})
    headers = Headers.new({"content-type": "application/x-www-form-urlencoded"}.items())
    resp = await fetch("https://oauth2.googleapis.com/token", method="POST", headers=headers, body=body)
    if not resp.ok:
        raise Exception(f"Google OAuth error: {await resp.text()}")
    return (await resp.json()).to_py()["access_token"]


def _extract_sheet_id(url: str) -> str:
    try:
        return url.split("/d/")[1].split("/")[0]
    except IndexError:
        raise ValueError(f"Cannot extract spreadsheet ID from URL: {url}")


async def get_worksheet_names(spreadsheet_url: str, sa: dict) -> list[str]:
    from js import fetch, Headers  # type: ignore[import]

    sheet_id = _extract_sheet_id(spreadsheet_url)
    token = await _get_access_token(sa)
    headers = Headers.new({"Authorization": f"Bearer {token}"}.items())
    resp = await fetch(f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}", method="GET", headers=headers)
    if not resp.ok:
        err_msg = await resp.text()
        raise Exception(f"Sheets API error {resp.status}: {err_msg}")
    data = (await resp.json()).to_py()
    return [s["properties"]["title"] for s in data.get("sheets", [])]


async def get_table_data(spreadsheet_url: str, worksheet: str, sa: dict) -> dict:
    from js import fetch, Headers  # type: ignore[import]

    sheet_id = _extract_sheet_id(spreadsheet_url)
    token = await _get_access_token(sa)
    headers_js = Headers.new({"Authorization": f"Bearer {token}"}.items())

    safe_worksheet = worksheet.replace("'", "''")
    range_param = quote(f"'{safe_worksheet}'")

    resp = await fetch(
        f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{range_param}",
        method="GET",
        headers=headers_js,
    )
    if not resp.ok:
        err_msg = await resp.text()
        raise Exception(f"Sheets API error {resp.status}: {err_msg}")

    all_rows = (await resp.json()).to_py().get("values", [])
    if not all_rows:
        return {"headers": [], "rows": []}

    col_headers = all_rows[0]
    data_rows = all_rows[1:]
    padded = [r + [""] * (len(col_headers) - len(r)) for r in data_rows]
    return {"headers": col_headers, "rows": padded}


async def get_stock_list(spreadsheet_url: str, worksheet: str, sa: dict) -> list[dict]:
    from js import fetch, Headers  # type: ignore[import]

    sheet_id = _extract_sheet_id(spreadsheet_url)
    token = await _get_access_token(sa)
    headers = Headers.new({"Authorization": f"Bearer {token}"}.items())

    # Format & URL-encode worksheet range (e.g. 'Sheet1'!A:B)
    safe_worksheet = worksheet.replace("'", "''")
    range_param = quote(f"'{safe_worksheet}'!A:B")

    resp = await fetch(
        f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{range_param}",
        method="GET",
        headers=headers,
    )
    if not resp.ok:
        err_msg = await resp.text()
        raise Exception(f"Sheets API error {resp.status}: {err_msg}")

    rows = (await resp.json()).to_py().get("values", [])

    # Column A = Name (r[0]), Column B = Symbol/Ticker (r[1])
    return [
        {"name": str(r[0]).strip(), "ticker": str(r[1]).strip()}
        for r in rows[1:]
        if len(r) >= 2 and r[0] and r[1]
    ]