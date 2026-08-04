import json
import os
import re


def _clean(raw: str) -> str:
    """Strip control characters that break JSON parsing."""
    return re.sub(r'[\x00-\x1f\x7f]', '', raw)


import os

class Settings:
    @property
    def sheet_urls(self) -> list[str]:
        raw = os.environ.get("SHEET_URLS", "")
        return [url.strip() for url in raw.split(",") if url.strip()]

    @property
    def sheet_labels(self) -> list[str]:
        raw = os.environ.get("SHEET_LABELS", "")
        labels = [l.strip() for l in raw.split(",") if l.strip()]
        # Fallback jika bilangan label tak sama dengan URL
        urls = self.sheet_urls
        while len(labels) < len(urls):
            labels.append(f"Sheet {len(labels) + 1}")
        return labels

    @property
    def gcp_service_account(self) -> str:
        return os.environ.get("GCP_SERVICE_ACCOUNT", "")

settings = Settings()