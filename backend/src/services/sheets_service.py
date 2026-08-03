"""Google Sheets REST API — uses Workers native fetch + Web Crypto API for JWT."""
import base64
import json
import time

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
    crypto_key = await crypto.subtle.importKey("pkcs8", key_view, algo, False, ["sign"])

    # Sign
    msg_view = Uint8Array.new(signing_input.encode())
    sig_buffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", crypto_key, msg_view)
    sig_bytes = bytes(Uint8Array.new(sig_buffer))

    return f"{header}.{body}.{_b64url(sig_bytes)}"


async def _get_access_token(sa: dict) -> str:
    from js import fetch, Headers  # type: ignore[import]
    from urllib.parse import urlencode

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
        raise Exception(f"Sheets API error: {resp.status}")
    data = (await resp.json()).to_py()
    return [s["properties"]["title"] for s in data.get("sheets", [])]


async def get_stock_list(spreadsheet_url: str, worksheet: str, sa: dict) -> list[dict]:
    from js import fetch, Headers  # type: ignore[import]

    sheet_id = _extract_sheet_id(spreadsheet_url)
    token = await _get_access_token(sa)
    headers = Headers.new({"Authorization": f"Bearer {token}"}.items())
    resp = await fetch(
        f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{worksheet}!A:B",
        method="GET",
        headers=headers,
    )
    if not resp.ok:
        raise Exception(f"Sheets API error: {resp.status}")
    rows = (await resp.json()).to_py().get("values", [])
    return [{"name": r[0], "ticker": r[1]} for r in rows[1:] if len(r) >= 2 and r[0] and r[1]]
