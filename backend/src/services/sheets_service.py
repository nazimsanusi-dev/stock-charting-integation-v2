"""Google Sheets REST API — replaces gspread."""
import json
import time
import httpx
import jwt  # PyJWT[crypto]

_SCOPES = (
    "https://www.googleapis.com/auth/spreadsheets.readonly "
    "https://www.googleapis.com/auth/drive.readonly"
)


def _extract_sheet_id(url: str) -> str:
    try:
        return url.split("/d/")[1].split("/")[0]
    except IndexError:
        raise ValueError(f"Cannot extract spreadsheet ID from URL: {url}")


async def _get_access_token(sa: dict) -> str:
    now = int(time.time())
    payload = {
        "iss": sa["client_email"],
        "scope": _SCOPES,
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    signed = jwt.encode(payload, sa["private_key"], algorithm="RS256")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": signed,
            },
        )
        resp.raise_for_status()
    return resp.json()["access_token"]


async def get_worksheet_names(spreadsheet_url: str, sa: dict) -> list[str]:
    sheet_id = _extract_sheet_id(spreadsheet_url)
    token = await _get_access_token(sa)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
    return [s["properties"]["title"] for s in resp.json().get("sheets", [])]


async def get_stock_list(
    spreadsheet_url: str, worksheet: str, sa: dict
) -> list[dict]:
    sheet_id = _extract_sheet_id(spreadsheet_url)
    token = await _get_access_token(sa)
    range_ref = f"{worksheet}!A:B"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{range_ref}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
    rows = resp.json().get("values", [])
    return [
        {"name": r[0], "ticker": r[1]}
        for r in rows[1:]  # skip header row
        if len(r) >= 2 and r[0] and r[1]
    ]
