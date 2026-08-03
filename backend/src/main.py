from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import sheets, stocks

app = FastAPI(title="Stock Monitor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(sheets.router, prefix="/api", tags=["sheets"])
app.include_router(stocks.router, prefix="/api", tags=["stocks"])


@app.get("/health")
async def health():
    return {"status": "ok"}
