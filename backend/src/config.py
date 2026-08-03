import json
import os
import re


def _clean(raw: str) -> str:
    """Strip control characters that break JSON parsing."""
    return re.sub(r'[\x00-\x1f\x7f]', '', raw)


class Settings:
    @property
    def sheet_urls(self) -> list[str]:
        return json.loads(_clean(os.environ.get("SHEET_URLS", "[]")))

    @property
    def sheet_labels(self) -> list[str]:
        return json.loads(_clean(os.environ.get("SHEET_LABELS", "[]")))

    @property
    def gcp_service_account(self) -> dict:
        return json.loads(_clean(os.environ.get("GCP_SERVICE_ACCOUNT", "{}")))


settings = Settings()
