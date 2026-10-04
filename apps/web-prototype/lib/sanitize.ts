/**
 * assistant 텍스트에서 렌더링되지 않는 마크다운 장식 토큰을 보수적으로 제거한다.
 * 적용 시점은 assistant 메시지의 "생성"(engine.ts)과 "표시"(ChatBubble 등)뿐 —
 * 사용자 입력에는 적용하지 않는다(원문 보존, React 가 이스케이프하므로 안전).
 *
 * 제거: ** (굵게), __ (굵게/밑줄 쌍), 행머리 #(제목), 백틱(코드).
 * 보존: 단일 *, 대시(-), 단독 밑줄(_) — 목록·강조 아닌 일반 문자로 쓰일 수 있음.
 */
export function stripHiddenMarkdownTokens(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/`+/g, '');
}
