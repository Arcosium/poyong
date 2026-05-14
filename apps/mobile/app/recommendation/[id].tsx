import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { PolicyCard } from "@/components/PolicyCard";
import { AppText, Heading, PrimaryButton, Screen } from "@/components/ui";
import { api } from "@/lib/api";

export default function RecommendationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["recommendation", id],
    queryFn: () => api.getRecommendation(id!),
    enabled: !!id,
  });
  const [sent, setSent] = useState<string | null>(null);
  const feedback = useMutation({
    mutationFn: (action: "applied" | "rejected" | "viewed") => api.sendRecommendationFeedback(id!, action),
    onSuccess: (_d, action) => setSent(action),
  });

  if (isLoading || !data) {
    return (
      <Screen edges={["bottom"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0E7C6B" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Heading>포용이의 추천 이유</Heading>
        {data.gap_signal ? (
          <AppText variant="base" className="text-amber-700 dark:text-amber-400">
            ⚠ {data.gap_signal}
          </AppText>
        ) : null}

        {data.recommendations.map((r) => (
          <View key={r.product.code} className="gap-2">
            <PolicyCard product={r.product} score={r.match_score} />
            {r.reasons.length > 0 ? (
              <View className="bg-brand-light dark:bg-brand-dark/30 rounded-xl p-3 gap-1">
                <AppText variant="base" bold className="text-brand-dark dark:text-brand-light">
                  이렇게 맞아요
                </AppText>
                {r.reasons.map((reason, i) => (
                  <AppText key={i} variant="base">
                    · {reason}
                  </AppText>
                ))}
              </View>
            ) : null}
            {r.concerns.length > 0 ? (
              <View className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3 gap-1">
                <AppText variant="base" bold className="text-amber-800 dark:text-amber-300">
                  미리 알아두세요
                </AppText>
                {r.concerns.map((c, i) => (
                  <AppText key={i} variant="base">
                    · {c}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {/* 피드백 — 무엇이 실제로 도움이 됐는지 익명으로 모은다(추천 품질 개선용) */}
        <View className="mt-2 gap-2">
          {sent ? (
            <AppText variant="base" muted className="text-center">
              {sent === "applied" ? "신청하셨다니 다행이에요. 잘 진행되길 바라요." : "알려주셔서 고마워요. 다음엔 더 잘 맞춰볼게요."}
            </AppText>
          ) : (
            <>
              <AppText variant="base" muted className="text-center">
                이 추천이 도움이 되셨나요?
              </AppText>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <PrimaryButton label="신청했어요" onPress={() => feedback.mutate("applied")} />
                </View>
                <View className="flex-1">
                  <PrimaryButton label="안 맞아요" variant="tinted" onPress={() => feedback.mutate("rejected")} />
                </View>
              </View>
            </>
          )}
        </View>

        <AppText variant="hint" muted className="text-center mt-2">
          신청 절차가 헷갈리시면 서민금융통합지원센터 ☎ 1397 로 문의하세요.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
