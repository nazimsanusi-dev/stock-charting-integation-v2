import json
import os


class Settings:
    @property
    def sheet_urls(self) -> list[str]:
        raw = os.environ.get("SHEET_URLS", "[]")
        return json.loads(raw)

    @property
    def sheet_labels(self) -> list[str]:
        raw = os.environ.get("SHEET_LABELS", "[]")
        return json.loads(raw)

    @property
    def gcp_service_account(self) -> dict:
        raw = os.environ.get("GCP_SERVICE_ACCOUNT", "{}")
        return json.loads(raw)


settings = Settings()
