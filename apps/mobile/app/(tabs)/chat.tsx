import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";

import { MessageBubble, type ChatTurn } from "@/components/MessageBubble";
import { Screen } from "@/components/ui";
import { api, type SuggestedAction } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useFontSize } from "@/lib/ui";

const GREETING: ChatTurn = {
  id: "greeting",
  role: "assistant",
  content:
    "안녕하세요, 포용이예요. 어떤 일로 오셨는지 편하게 말씀해 주세요. 한 번에 다 말씀 안 하셔도 괜찮아요.",
};

export default function Chat() {
  const router = useRouter();
  const conversationId = useAppStore((s) => s.currentConversationId);
  const setConversationId = useAppStore((s) => s.setCurrentConversationId);
  const { fs } = useFontSize();

  const [turns, setTurns] = useState<ChatTurn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const listRef = useRef<FlatList<ChatTurn>>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: "user", content: text }]);
    try {
      const res = await api.sendChatMessage(text, conversationId ?? undefined);
      setConversationId(res.conversation_id);
      setActions(res.suggested_actions);
      setTurns((t) => [...t, { id: `a-${Date.now()}`, role: "assistant", content: res.assistant_message }]);
    } catch {
      setTurns((t) => [
        ...t,
        { id: `e-${Date.now()}`, role: "assistant", content: "죄송해요, 잠시 문제가 있었어요. 다시 한 번 보내주시겠어요?" },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, conversationId, setConversationId]);

  const canMatch = actions.includes("start_matching") || actions.includes("view_recommendations");

  return (
    <Screen edges={["bottom"]} className="bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <MessageBubble turn={item} />}
          contentContainerClassName="px-4 py-3"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {sending ? (
          <View className="px-4 pb-1">
            <ActivityIndicator color="#0E7C6B" />
          </View>
        ) : null}

        {canMatch ? (
          <Pressable
            onPress={async () => {
              try {
                await api.generateRecommendations();
              } finally {
                router.push("/(tabs)");
              }
            }}
            className="mx-4 mb-2 bg-brand-dark rounded-xl py-3 items-center active:opacity-80"
          >
            <Text className="text-white" style={{ fontSize: fs(18), fontWeight: "700" }}>
              이제 맞는 정책 추천 받기
            </Text>
          </Pressable>
        ) : null}

        <View className="flex-row items-end gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
          <TextInput
            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 text-gray-900 dark:text-gray-50 max-h-32"
            style={{ fontSize: fs(18) }}
            placeholder="여기에 적어주세요"
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || sending}
            className={`rounded-2xl px-5 py-3 ${input.trim() && !sending ? "bg-brand active:opacity-80" : "bg-gray-300 dark:bg-gray-700"}`}
          >
            <Text className="text-white" style={{ fontSize: fs(18), fontWeight: "700" }}>
              보내기
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
