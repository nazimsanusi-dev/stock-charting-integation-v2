"""Cloudflare Workers Python entry point."""
import os


def _load_env(env) -> None:
    """Copy Workers secret bindings into os.environ for config.py to read."""
    for key in ("SHEET_URLS", "SHEET_LABELS", "GCP_SERVICE_ACCOUNT"):
        try:
            value = getattr(env, key, None)
            if value and key not in os.environ:
                os.environ[key] = str(value)
        except Exception:
            pass


async def on_fetch(request, env):  # noqa: ANN001
    _load_env(env)
    from src.main import app
    from src.worker_adapter import handle_asgi

    return await handle_asgi(app, request, env)
