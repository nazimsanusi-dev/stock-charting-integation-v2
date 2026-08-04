import json
import os
import re


def _clean(raw: str) -> str:
    """Strip control characters that break JSON parsing."""
    return re.sub(r'[\x00-\x1f\x7f]', '', raw)


class Settings:
    @property
    def sheet_urls(self) -> list[str]:
        raw = os.environ.get("SHEET_URLS", "").strip()
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [url.strip() for url in raw.split(",") if url.strip()]

    @property
    def sheet_labels(self) -> list[str]:
        raw = os.environ.get("SHEET_LABELS", "").strip()
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except Exception:
                pass
        
        labels = [l.strip() for l in raw.split(",") if l.strip()]
        urls = self.sheet_urls
        while len(labels) < len(urls):
            labels.append(f"Sheet {len(labels) + 1}")
        return labels

    @property
    def gcp_service_account(self) -> str:
        # Bersihkan sebarang control characters jika ada
        raw = os.environ.get("GCP_SERVICE_ACCOUNT", "")
        return raw


settings = Settings()