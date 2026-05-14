import { NextRequest, NextResponse } from "next/server";

/**
 * 대시보드 전체를 HTTP Basic Auth 로 보호 (Implementation.md §8 Step 9 — "로그인 페이지 Basic Auth 환경변수 시작").
 * 운영에선 IP allowlist / SSO 로 강화할 것.
 */
const USER = process.env.GOV_DASHBOARD_BASIC_AUTH_USER ?? "admin";
const PASS = process.env.GOV_DASHBOARD_BASIC_AUTH_PASS ?? "change-me";

export function middleware(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [u, p] = atob(header.slice(6)).split(":");
    if (u === USER && p === PASS) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FIN:NECT Dashboard"' },
  });
}

export const config = {
  // 정적 자산·이미지 최적화 경로는 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
