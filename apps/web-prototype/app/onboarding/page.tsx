'use client';

import Link from 'next/link';

// '서민금융 잇다' 랜딩을 참고한 구성 — 연블루 배경 + 컬러 키워드 헤드라인 +
// 알약형 CTA 2개(파랑/핑크) + 사용법 3카드. (연구용 시연, 잇다·서금원과 무관)
const USAGE_CARDS = [
  { emoji: '📖', text: '내게 가장 유리한 상품을 알아보아요.' },
  { emoji: '💬', text: '금융으로 해결되지 않는 고민을 나눠보아요.' },
  { emoji: '📡', text: '연결이 안 된 이유는 표준 코드로 기록돼 정책에 전달돼요.' },
];

export default function Onboarding() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-sky pb-10">
      <header className="flex items-center justify-between bg-white px-5 py-3">
        <div className="text-xl font-extrabold text-ink">
          포용<span className="text-brand-500">이</span>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">
          잇다 연동 모듈 시연
        </span>
      </header>

      <section className="px-6 pt-12 text-center">
        <div className="text-3xl">🤝</div>
        <h1 className="mt-4 text-2xl font-extrabold leading-snug text-ink">
          <span className="text-brand-500">금융상품</span>과{' '}
          <span className="text-accent-500">복합지원</span>을
          <br />한 번에 이용할 수 있어요!
        </h1>

        <p className="mt-10 text-[15px] font-semibold text-ink">
          나에게 딱 맞는 <span className="text-brand-500">대출</span>과{' '}
          <span className="text-accent-500">복합지원</span> 한번에 잇다!
        </p>
        <Link
          href="/onboarding/consent"
          className="mt-3 block rounded-full bg-brand-500 py-4 text-center text-lg font-bold text-white shadow-lg shadow-brand-200 active:scale-[0.99]"
        >
          포용이 시작하기
        </Link>

        <p className="mt-6 text-[15px] font-semibold text-ink">
          흩어진 고용·복지·채무조정 등 <span className="text-accent-500">복합지원</span> 잇다!
        </p>
        <Link
          href="/onboarding/consent"
          className="mt-3 block rounded-full bg-accent-500 py-4 text-center text-lg font-bold text-white shadow-lg shadow-accent-100 active:scale-[0.99]"
        >
          복합지원 바로가기
        </Link>

        <a
          href="https://poyong.ai-ve.uk/Poyong.apk"
          className="mt-6 block rounded-full bg-white py-3.5 text-center text-base font-bold text-ink shadow"
        >
          📱 App 바로가기
        </a>
      </section>

      <section className="mt-14 px-6 text-center">
        <div className="text-2xl">💬</div>
        <h2 className="mt-2 text-xl font-extrabold text-ink">
          <span className="text-brand-500">&lsquo;포용이&rsquo;</span>란 무엇인가요?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          서민금융진흥원의 종합플랫폼 &lsquo;서민금융 잇다&rsquo;의 UI·이용 동선 위에, 상담
          과정에서 생기는 <b>미매칭 사유(안내·자격·한도·증빙)를 표준 코드로 기록</b>하고
          정책 조기경보로 환류하는 <b>분석 모듈</b>을 얹으면 어떤 신호가 쌓이는지 보여주는
          연구용 시연이에요.
        </p>
        <div className="mt-6 space-y-4">
          {USAGE_CARDS.map((c) => (
            <div key={c.text} className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="text-3xl">{c.emoji}</div>
              <p className="mt-3 text-[15px] font-semibold text-ink">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 px-8 text-center text-[11px] leading-relaxed text-gray-400">
        본 화면은 재정데이터 분석 경진대회 제출용 연구 프로토타입으로, 서민금융진흥원
        &lsquo;서민금융 잇다&rsquo;의 UI를 참고한 비공식 시연입니다. 서민금융진흥원·잇다와
        무관하며 실제 금융상품 신청·알선 기능이 없습니다.
      </p>
    </div>
  );
}
