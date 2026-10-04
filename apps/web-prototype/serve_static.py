"""poyong 정적 프로토타입 서버 (out/ 정적 익스포트를 uvicorn+starlette로 서빙).

기존 `python3 -m http.server`(단일스레드) 대체 — poyong-web.service가 실행.
html=True: /chat → chat.html·chat/index.html 해석, 404는 out/404.html.

/api/* 는 FastAPI 백엔드(127.0.0.1:8010, poyong-api user unit)로 리버스 프록시한다 —
cloudflared 는 8090 하나만 바라보면 되므로 터널 설정 변경(sudo) 없이 백엔드를 노출한다.
브라우저(https://poyong.ai-ve.uk)는 same-origin 이라 CORS 불필요, Capacitor APK
(origin https://localhost)의 CORS 헤더는 백엔드가 붙이고 프록시는 그대로 통과시킨다.
"""
from pathlib import Path

import httpx
from starlette.applications import Starlette
from starlette.responses import FileResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

OUT = Path(__file__).resolve().parent / "out"
API_UPSTREAM = "http://127.0.0.1:8010"

# 채팅 의도추출이 로컬 LLM(추론 모델)을 타므로 넉넉한 타임아웃이 필요하다.
_client = httpx.AsyncClient(base_url=API_UPSTREAM, timeout=httpx.Timeout(120.0, connect=5.0))

_HOP_BY_HOP = {
    "host", "content-length", "connection", "keep-alive", "transfer-encoding",
    "te", "trailers", "upgrade", "proxy-authenticate", "proxy-authorization",
}


async def api_proxy(request):
    url = request.url.path
    if request.url.query:
        url += "?" + request.url.query
    headers = {k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP}
    body = await request.body()
    try:
        upstream = await _client.request(request.method, url, headers=headers, content=body)
    except httpx.HTTPError:
        return Response(
            '{"detail":"백엔드 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."}',
            status_code=502,
            media_type="application/json",
        )
    resp_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in _HOP_BY_HOP and k.lower() != "content-encoding"
    }
    return Response(upstream.content, status_code=upstream.status_code, headers=resp_headers)


async def not_found(request, exc):
    page = OUT / "404.html"
    if page.exists():
        return FileResponse(page, status_code=404)
    raise exc


app = Starlette(
    routes=[
        Route("/api/{rest:path}", api_proxy, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]),
        Mount("/", StaticFiles(directory=OUT, html=True), name="static"),
    ],
    exception_handlers={404: not_found},
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8090)
