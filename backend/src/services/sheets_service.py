"""Google Sheets REST API — uses Workers native fetch + Pyodide cryptography for JWT."""
import base64
import json
import time

_SCOPES = (
    "https://www.googleapis.com/auth/spreadsheets.readonly "
    "https://www.googleapis.com/auth/drive.readonly"
)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _make_jwt(payload: dict, private_key_pem: str) -> str:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}".encode()
    key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    sig = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    return f"{header}.{body}.{_b64url(sig)}"


async def _get_access_token(sa: dict) -> str:
    from js import fetch, Headers  # type: ignore[import]
    from urllib.parse import urlencode

    now = int(time.time())
    token = _make_jwt({
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
