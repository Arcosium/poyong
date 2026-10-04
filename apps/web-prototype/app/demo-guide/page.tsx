'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  { title: '상담 정보 확인', note: '상황 · 긴급도 · 지역' },
  { title: '맞춤 추천 요청', note: '조건에 맞는 제도 탐색' },
  { title: '미매칭 코드 기록', note: '연결되지 않은 이유 구조화' },
  { title: '정책 사각지대 집계', note: '지역 × 상황 × 미매칭 사유' },
];

const STAGE_TIMES = [0, 3200, 6000, 9100];

function ConsultationStage() {
  const rows = [
    ['어떤 상황인가요?', '갑자기 일이 끊겨 생활비가 부족해요'],
    ['얼마나 긴급한가요?', '오늘 안에 도움이 필요해요'],
    ['어느 지역에 계신가요?', '경상남도'],
  ];
  return (
    <div className="grid h-full grid-cols-[0.95fr_1.05fr] gap-6">
      <div className="flex flex-col justify-center">
        <span className="w-fit rounded-full bg-teal-100 px-4 py-2 text-sm font-extrabold text-teal-800">
          1. 포용이 상담
        </span>
        <h1 className="mt-5 text-4xl font-black leading-tight text-slate-900">
          필요한 정보만
          <br />
          짧게 확인합니다
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          상황, 긴급도, 지역을 물어
          <br />
          지원 가능성을 좁힙니다.
        </p>
      </div>
      <div className="flex flex-col justify-center gap-3 rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-xl text-white">P</span>
          <div>
            <b className="text-lg text-slate-900">AI 멘토 포용이</b>
            <p className="text-sm text-slate-500">상담 정보 확인 중</p>
          </div>
        </div>
        {rows.map(([question, answer], index) => (
          <div
            key={question}
            className="demo-rise rounded-2xl bg-slate-50 p-4"
            style={{ animationDelay: `${index * 0.45}s` }}
          >
            <p className="text-sm font-bold text-slate-600">{question}</p>
            <p className="mt-1.5 flex items-center gap-2 text-[17px] font-extrabold text-teal-700">
              <span className="text-teal-500">✓</span>
              {answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendStage() {
  return (
    <div className="grid h-full grid-cols-[0.85fr_1.15fr] items-center gap-8">
      <div>
        <span className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-extrabold text-indigo-800">
          2. 추천 실행
        </span>
        <h1 className="mt-5 text-4xl font-black leading-tight text-slate-900">
          상담이 끝나면
          <br />
          추천을 요청합니다
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          입력한 조건으로 정책금융 상품을
          <br />
          자동으로 확인합니다.
        </p>
      </div>
      <div className="rounded-[34px] border border-indigo-100 bg-white p-8 shadow-2xl">
        <div className="flex flex-wrap gap-2">
          {['생활비 부족', '긴급', '경상남도'].map((chip) => (
            <span key={chip} className="rounded-full bg-indigo-50 px-4 py-2 font-bold text-indigo-700">
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-7 rounded-3xl bg-slate-50 p-6">
          <p className="text-sm font-bold text-slate-500">조건 확인 완료</p>
          <p className="mt-2 text-2xl font-black text-slate-900">맞춤 정책을 찾아볼게요</p>
          <p className="mt-2 text-slate-500">자격 요건과 지원 한도를 함께 확인합니다.</p>
        </div>
        <button className="demo-pulse mt-6 w-full rounded-2xl bg-indigo-600 py-5 text-xl font-black text-white shadow-lg">
          맞춤 추천 받기
        </button>
      </div>
    </div>
  );
}

function CodeStage() {
  const codes = [
    ['자격 미달', 'eligibility_fail', '소득·재직 요건 불일치'],
    ['한도 초과', 'limit_exceeded', '필요 금액이 상품 한도 초과'],
  ];
  return (
    <div className="grid h-full grid-cols-[0.8fr_1.2fr] items-center gap-8">
      <div>
        <span className="rounded-full bg-rose-100 px-4 py-2 text-sm font-extrabold text-rose-800">
          3. 미매칭 기록
        </span>
        <h1 className="mt-5 text-4xl font-black leading-tight text-slate-900">
          추천되지 않아도
          <br />
          이유가 남습니다
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          개인을 식별하지 않는 표준 코드로
          <br />
          정책의 빈틈을 기록합니다.
        </p>
      </div>
      <div className="rounded-[34px] border border-rose-100 bg-white p-7 shadow-2xl">
        <div className="rounded-2xl bg-rose-50 p-5">
          <p className="text-sm font-extrabold text-rose-600">맞는 상품을 찾지 못했습니다</p>
          <p className="mt-1 text-xl font-black text-slate-900">연결되지 않은 이유를 신호로 남깁니다</p>
        </div>
        <div className="mt-4 space-y-3">
          {codes.map(([label, code, detail], index) => (
            <div
              key={code}
              className="demo-rise flex items-center justify-between rounded-2xl border border-slate-200 p-4"
              style={{ animationDelay: `${index * 0.3}s` }}
            >
              <div>
                <b className="text-lg text-slate-900">{label}</b>
                <p className="mt-1 text-sm text-slate-500">{detail}</p>
              </div>
              <code className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-teal-300">{code}</code>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm font-bold text-teal-700">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100">✓</span>
          익명 표준 코드 저장 완료
        </p>
      </div>
    </div>
  );
}

function DashboardStage() {
  return (
    <div className="h-full rounded-[28px] border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <p className="text-sm font-bold text-slate-500">포용금융 정책수요 대시보드</p>
          <h1 className="text-2xl font-black text-slate-900">정책 사각지대</h1>
        </div>
        <span className="rounded-full bg-teal-100 px-4 py-2 text-sm font-extrabold text-teal-800">
          실시간 익명 집계
        </span>
      </div>
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-5 p-6">
        <section>
          <h2 className="font-black text-slate-800">지역 × 상황 미매칭 신호</h2>
          <table className="mt-3 w-full overflow-hidden rounded-xl text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr><th className="p-3">지역</th><th className="p-3">상황</th><th className="p-3">신호</th></tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b"><td className="p-3 font-bold">경상남도</td><td className="p-3">생활비 부족</td><td className="p-3 font-black text-rose-600">18건</td></tr>
              <tr className="border-b"><td className="p-3 font-bold">부산광역시</td><td className="p-3">채무 부담</td><td className="p-3 font-black text-rose-600">14건</td></tr>
              <tr><td className="p-3 font-bold">전라남도</td><td className="p-3">긴급 생계</td><td className="p-3 font-black text-rose-600">11건</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="font-black text-slate-800">미매칭 사유</h2>
          <div className="mt-4 space-y-4">
            {[
              ['자격 미달', 64, '32건'],
              ['한도 초과', 42, '21건'],
              ['증빙 불가', 26, '13건'],
            ].map(([label, width, value]) => (
              <div key={label as string}>
                <div className="flex justify-between text-sm font-bold text-slate-600"><span>{label}</span><span>{value}</span></div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="demo-bar h-full rounded-full bg-teal-500" style={{ width: `${width}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-teal-50 p-4 text-sm font-bold leading-relaxed text-teal-900">
            상담 신호가 지역·상황·미매칭 사유별로 모여 정책 보완의 근거가 됩니다.
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DemoGuidePage() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = STAGE_TIMES.slice(1).map((time, index) =>
      window.setTimeout(() => setStage(index + 1), time),
    );
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <main className="demo-canvas flex min-h-screen items-center justify-center bg-[#e9efff] p-8">
      <style jsx global>{`
        @keyframes demo-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes demo-pulse { 0%, 100% { transform: scale(1); box-shadow: 0 16px 35px rgba(79,70,229,.22); } 50% { transform: scale(1.025); box-shadow: 0 20px 45px rgba(79,70,229,.42); } }
        @keyframes demo-bar { from { width: 0; } }
        .demo-rise { opacity: 0; animation: demo-rise .45s ease-out forwards; }
        .demo-pulse { animation: demo-pulse 1.15s ease-in-out infinite; }
        .demo-bar { animation: demo-bar .8s ease-out both; }
      `}</style>
      <div className="grid h-[656px] w-[1216px] grid-rows-[72px_1fr] overflow-hidden rounded-[36px] bg-slate-50 shadow-2xl">
        <header className="flex items-center justify-between bg-slate-900 px-7 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500 text-xl font-black">P</span>
            <div><b className="text-lg">포용이 데모 사용법</b><p className="text-xs text-white/55">상담 신호가 정책 개선 자료가 되는 과정</p></div>
          </div>
          <div className="flex gap-2">
            {STAGES.map((item, index) => (
              <div key={item.title} className={`rounded-xl px-3 py-2 transition ${index === stage ? 'bg-white text-slate-900' : index < stage ? 'bg-teal-500/30 text-teal-100' : 'bg-white/5 text-white/45'}`}>
                <p className="text-xs font-black">{index + 1}. {item.title}</p>
                <p className="text-[10px] opacity-70">{item.note}</p>
              </div>
            ))}
          </div>
        </header>
        <section key={stage} className="demo-rise p-8">
          {stage === 0 ? <ConsultationStage /> : null}
          {stage === 1 ? <RecommendStage /> : null}
          {stage === 2 ? <CodeStage /> : null}
          {stage === 3 ? <DashboardStage /> : null}
        </section>
      </div>
    </main>
  );
}
