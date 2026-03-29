#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parent.parent


class BookPipelineProxyHandler(SimpleHTTPRequestHandler):
    server_version = "BookPipelineProxy/1.0"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Upstream-Base-Url")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/api/chat/completions":
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        upstream_base = self.headers.get("X-Upstream-Base-Url", "").strip().rstrip("/")
        if not upstream_base:
            self.send_error(HTTPStatus.BAD_REQUEST, "Missing X-Upstream-Base-Url header")
            return

        parsed = urlparse(upstream_base)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid upstream base URL")
            return

        content_length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(content_length)

        request = Request(
            url=f"{upstream_base}/chat/completions",
            data=body,
            method="POST",
            headers={
                "Content-Type": self.headers.get("Content-Type", "application/json"),
                "Authorization": self.headers.get("Authorization", ""),
            },
        )

        try:
            with urlopen(request, timeout=180) as response:
                response_body = response.read()
                status = response.status
                content_type = response.headers.get("Content-Type", "application/json; charset=utf-8")
        except HTTPError as exc:
            response_body = exc.read()
            status = exc.code
            content_type = exc.headers.get("Content-Type", "application/json; charset=utf-8")
        except URLError as exc:
            payload = json.dumps({
                "error": {
                    "message": f"Upstream request failed: {exc.reason}",
                    "type": "proxy_error",
                }
            }).encode("utf-8")
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(response_body)))
        self.end_headers()
        self.wfile.write(response_body)


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(BookPipelineProxyHandler, directory=str(REPO_ROOT))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Serving {REPO_ROOT} at http://127.0.0.1:{port}")
        print("Proxy endpoint: /api/chat/completions")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
