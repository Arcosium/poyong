/**
 * 어려운 금융 용어를 "눌러서(또는 길게 눌러서) 쉬운 설명" 으로 보여주는 컴포넌트
 * (Implementation.md §6 — "어려운 금융 용어는 길게 누르면 쉬운 설명 툴팁").
 *
 *   <GlossaryText text={assistantMessage} />   ← 본문에서 알려진 용어를 자동으로 탭 가능하게
 *   <GlossaryText text="신용점수" />            ← 한 용어만 보여주고 싶을 때(목록에 있으면 매칭됨)
 *
 * 설명 텍스트는 백엔드(POST /api/v1/glossary/explain)에서 받아 메모리에 캐시한다.
 *
 * RN 주의: <Modal> 은 <Text> 안에 둘 수 없어서, 탭 가능한 스팬은 일반 <Text> 로 두고
 *          모달은 본문 <AppText> 의 형제로 한 단계 바깥에서 렌더한다.
 */
import { Fragment, ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";

import { api } from "@/lib/api";
import { findGlossaryTerms } from "@/lib/glossary";
import { useFontSize } from "@/lib/ui";

import { AppText } from "./ui";

// term → explanation 캐시 (앱 세션 동안). 같은 용어를 다시 눌러도 재요청 안 함.
const _cache = new Map<string, string>();

function GlossaryModal({ term, onClose }: { term: string | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (term == null) return;
    const cached = _cache.get(term);
    if (cached) {
      setText(cached);
      return;
    }
    let cancelled = false;
    setText(null);
    setLoading(true);
    api
      .explainTerm(term)
      .then((res) => {
        _cache.set(term, res.explanation);
        if (!cancelled) setText(res.explanation);
      })
      .catch(() => {
        if (!cancelled) setText("설명을 가져오지 못했어요. 잠시 후 다시 눌러봐 주세요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term]);

  return (
    <Modal visible={term != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 gap-3" onPress={() => {}}>
          <View className="self-center w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <AppText variant="subtitle" bold>
            {term ?? ""}
          </AppText>
          {loading || text === null ? (
            <ActivityIndicator color="#0E7C6B" />
          ) : (
            <AppText variant="body">{text}</AppText>
          )}
          <Pressable onPress={onClose} className="mt-2 self-end px-4 py-2">
            <AppText variant="base" bold className="text-brand-dark dark:text-brand-light">
              닫기
            </AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function GlossaryText({ text, variant = "body" }: { text: string; variant?: "body" | "base" }) {
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const { fs } = useFontSize();
  const matches = findGlossaryTerms(text);

  let body: ReactNode;
  if (matches.length === 0) {
    body = <AppText variant={variant}>{text}</AppText>;
  } else {
    const parts: ReactNode[] = [];
    let cursor = 0;
    matches.forEach((m, i) => {
      if (m.start > cursor) parts.push(<Fragment key={`t-${i}`}>{text.slice(cursor, m.start)}</Fragment>);
      parts.push(
        <Text
          key={`g-${i}`}
          onPress={() => setOpenTerm(m.term)}
          onLongPress={() => setOpenTerm(m.term)}
          suppressHighlighting
          style={{
            textDecorationLine: "underline",
            textDecorationStyle: "dotted",
            color: "#0A5C4F",
            fontWeight: "600",
            fontSize: fs(18),
          }}
        >
          {text.slice(m.start, m.end)}
        </Text>,
      );
      cursor = m.end;
    });
    if (cursor < text.length) parts.push(<Fragment key="t-end">{text.slice(cursor)}</Fragment>);
    body = <AppText variant={variant}>{parts}</AppText>;
  }

  return (
    <>
      {body}
      <GlossaryModal term={openTerm} onClose={() => setOpenTerm(null)} />
    </>
  );
}
