"""ASGI adapter: bridges Cloudflare Workers Python request → FastAPI → Workers response."""


async def handle_asgi(app, request, env) -> object:  # type: ignore[return]
    from js import Response, Headers, Object  # type: ignore[import]
    from urllib.parse import urlparse

    parsed = urlparse(str(request.url))
    method = str(request.method).upper()

    body = b""
    if method not in ("GET", "HEAD"):
        body = (await request.text()).encode()

    raw_headers = dict(request.headers)
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "path": parsed.path or "/",
        "query_string": (parsed.query or "").encode(),
        "root_path": "",
        "scheme": parsed.scheme or "https",
        "server": (parsed.hostname or "localhost", parsed.port or 443),
        "headers": [(k.lower().encode(), v.encode()) for k, v in raw_headers.items()],
    }

    state: dict = {"status": 200, "headers": {}, "body": b""}

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(event: dict):
        if event["type"] == "http.response.start":
            state["status"] = event["status"]
            for k, v in event.get("headers", []):
                state["headers"][k.decode()] = v.decode()
        elif event["type"] == "http.response.body":
            state["body"] += event.get("body", b"")

    await app(scope, receive, send)

    headers = Headers.new(Object.fromEntries([[k, v] for k, v in state["headers"].items()]))
    return Response.new(
        state["body"].decode("utf-8", errors="replace"),
        status=state["status"],
        headers=headers,
    )
