import { View } from "react-native";

import { GlossaryText } from "./GlossaryTerm";
import { AppText } from "./ui";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ turn }: { turn: ChatTurn }) {
  const mine = turn.role === "user";
  return (
    <View className={`my-1.5 max-w-[85%] ${mine ? "self-end" : "self-start"}`}>
      <View
        className={`px-4 py-3 rounded-2xl ${
          mine ? "bg-brand rounded-br-sm" : "bg-gray-100 dark:bg-gray-700 rounded-bl-sm"
        }`}
      >
        {mine ? (
          // 사용자 발화: 흰 글씨, 용어 하이라이트 없음
          <AppText variant="body" className="text-white">
            {turn.content}
          </AppText>
        ) : (
          // '포용이' 답변: 어려운 금융 용어를 길게 누르면 쉬운 설명 (GlossaryText)
          <GlossaryText text={turn.content} variant="body" />
        )}
      </View>
    </View>
  );
}
