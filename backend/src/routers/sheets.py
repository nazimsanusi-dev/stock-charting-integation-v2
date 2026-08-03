from fastapi import APIRouter, HTTPException, Query
from ..config import settings
from ..services import sheets_service

router = APIRouter()


@router.get("/sheets")
async def list_sheets():
    """Return configured Google Sheet entries."""
    return {
        "sheets": [
            {"url": url, "label": label}
            for url, label in zip(settings.sheet_urls, settings.sheet_labels)
        ]
    }


@router.get("/stocks")
async def list_stocks(
    sheet_url: str = Query(..., description="Google Sheets URL"),
    worksheet: str = Query("Stock_List", description="Worksheet / tab name"),
):
    """Return stock list from the specified Google Sheet."""
    sa = settings.gcp_service_account
    if not sa:
        raise HTTPException(status_code=503, detail="Google credentials not configured")
    try:
        stocks = await sheets_service.get_stock_list(sheet_url, worksheet, sa)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google Sheets error: {exc}") from exc
    return {"stocks": stocks}


@router.get("/worksheets")
async def list_worksheets(sheet_url: str = Query(...)):
    """Return worksheet names inside a spreadsheet."""
    sa = settings.gcp_service_account
    if not sa:
        raise HTTPException(status_code=503, detail="Google credentials not configured")
    try:
        names = await sheets_service.get_worksheet_names(sheet_url, sa)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"worksheets": names}
