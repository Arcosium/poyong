"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type AccountAuthResponse, type AccountType, type AuthUser } from "@/lib/api";
import { useStore } from "@/lib/store";
import { SIDO } from "@/lib/util";

type Mode = "register" | "login";

function stripToken(data: AccountAuthResponse): AuthUser {
  const { token: _token, ...user } = data;
  return user;
}

function accountLabel(account: AccountType): string {
  return account === "government" ? "정부 회원" : "개인 회원";
}

export default function Consent() {
  const router = useRouter();
  const completeAuth = useStore((s) => s.completeAuth);
  const [mode, setMode] = useState<Mode>("register");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [agree, setAgree] = useState(false);
  const [region, setRegion] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 통계 반영 동의(agree)는 선택 항목 — 미동의로도 가입/로그인할 수 있다.
  const canSubmit =
    region &&
    username.trim().length >= 3 &&
    password.length >= 8 &&
    (mode === "login" || accountType === "individual" || organizationName.trim().length >= 2);

  async function submit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      let token = "";
      let user: AuthUser;
      if (mode === "login") {
        const data = await api.loginAccount({ username: username.trim(), password });
        token = data.token;
        user = stripToken(data);
      } else {
        const data = await api.registerAccount({
          username: username.trim(),
          password,
          account_type: accountType,
          display_name: displayName.trim() || null,
          organization_name: organizationName.trim() || null,
          consent_for_statistics: agree,
        });
        token = data.token;
        user = stripToken(data);
      }
      // 서버의 동의 상태를 그대로 존중한다(임의로 true 로 되돌리지 않음).
      // 철회/재동의는 내 정보 화면의 토글에서 명시적으로만 바꾼다.
      completeAuth(user, region);
      if (user.role === "government" || user.role === "admin") {
        router.replace("/gov");
      } else {
        // 신규 개인 회원은 '놓친 지원금 1분 점검'(미수급 스크리닝)으로 —
        // 자격이 있어도 몰라서 못 받는 병목을 온보딩에서 바로 짚는다.
        router.replace(mode === "register" ? "/onboarding/screening" : "/home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-5 py-8 dark:bg-gray-900">
      <h1 className="text-2xl font-extrabold leading-snug text-ink dark:text-white">
        포용이 이용을 위한
        <br />
        약관에 동의해주세요.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        개인을 식별하는 정보는 받지 않고, 상담에서 추출된 정책 수요만 시도 단위 통계로 반영합니다.
      </p>

      <div className="mt-5 grid grid-cols-2 rounded-xl bg-gray-200 p-1 text-sm font-bold dark:bg-gray-800">
        {["register", "login"].map((v) => {
          const active = mode === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v as Mode)}
              className={active ? "rounded-lg bg-white py-3 text-brand-700 shadow-sm dark:bg-gray-700 dark:text-white" : "rounded-lg py-3 text-gray-500"}
            >
              {v === "register" ? "회원가입" : "로그인"}
            </button>
          );
        })}
      </div>

      {mode === "register" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["individual", "government"] as AccountType[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAccountType(v)}
              className={accountType === v ? "rounded-xl border border-brand-500 bg-brand-50 py-3 text-sm font-bold text-brand-700" : "rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}
            >
              {accountLabel(v)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          아이디
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="영문, 숫자, ., _, - 사용"
          />
        </label>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          비밀번호
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="8자 이상, 특수문자 포함"
          />
        </label>
        {mode === "register" && accountType === "individual" ? (
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
            표시 이름
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="선택 입력"
            />
          </label>
        ) : null}
        {mode === "register" && accountType === "government" ? (
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
            기관명
            <input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="예: 보건복지부"
            />
          </label>
        ) : null}
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          거주 지역 또는 담당 지역
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">지역을 선택하세요</option>
            {SIDO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          <span className="mt-0.5">🔒</span>
          <p>
            <b>[안내]</b> 이름·주민등록번호 등 개인 식별 정보는 수집하지 않아요. 매칭이 안 된
            사유는 표준 코드로만 익명 기록돼요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAgree(!agree)}
          className="flex w-full items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left text-sm font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs text-white ${agree ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            ✓
          </span>
          <span>
            <b>[선택]</b> 익명 상담 수요를 정부 통계와 정책수요 대시보드에 반영하는 데
            동의합니다. 동의하지 않아도 서비스를 이용할 수 있고, 내 정보에서 언제든 바꿀 수
            있어요.
          </span>
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        disabled={!canSubmit || loading}
        onClick={submit}
        className="mt-6 rounded-full bg-brand-500 py-4 text-lg font-bold text-white shadow-lg shadow-brand-200 disabled:opacity-40 disabled:shadow-none"
      >
        {loading ? "처리 중" : mode === "register" ? "동의하고 시작하기" : "로그인하고 시작하기"}
      </button>

      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          API 서버: {api.baseUrl || "(same-origin)"}
        </p>
      ) : null}
    </div>
  );
}
