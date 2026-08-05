"""인메모리 슬라이딩 윈도 레이트리미터 — 브루트포스/열거 완화 (외부 의존성 없음).

- 로그인: username+IP 키당 1분 5회 초과 시 429.
- /auth/check-username: IP 키당 1분 5회 초과 시 429 (아이디 열거 완화).

한계(의도된 단순 구현): 프로세스 단위 계수라 멀티워커 배포에서는 워커별로 따로 센다.
현 배포(단일 uvicorn 프로세스, 127.0.0.1:8010 뒤 리버스프록시) 기준으로 충분하다.
"""

from __future__ import annotations

import threading
import time
from collections import deque

_MAX_TRACKED_KEYS = 10_000  # 메모리 상한 — 초과 시 빈 키부터 정리


class SlidingWindowRateLimiter:
    def __init__(self, max_attempts: int = 5, window_seconds: float = 60.0) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """이번 시도를 계수하고, 윈도 내 허용 횟수 이내면 True."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            q = self._hits.get(key)
            if q is None:
                if len(self._hits) >= _MAX_TRACKED_KEYS:
                    self._evict_stale(cutoff)
                q = deque()
                self._hits[key] = q
            while q and q[0] <= cutoff:
                q.popleft()
            if len(q) >= self.max_attempts:
                return False
            q.append(now)
            return True

    def _evict_stale(self, cutoff: float) -> None:
        for k in [k for k, q in self._hits.items() if not q or q[-1] <= cutoff]:
            del self._hits[k]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


login_limiter = SlidingWindowRateLimiter(max_attempts=5, window_seconds=60.0)
username_check_limiter = SlidingWindowRateLimiter(max_attempts=5, window_seconds=60.0)


def reset_all() -> None:
    """테스트 격리용."""
    login_limiter.reset()
    username_check_limiter.reset()
