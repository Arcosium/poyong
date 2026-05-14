import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { PolicyCard } from "@/components/PolicyCard";
import { AppText, Card, Heading, PrimaryButton, Screen } from "@/components/ui";
import { api } from "@/lib/api";

const PROFILE_LABEL: Record<string, Record<string, string>> = {
  age_group: { youth: "청년", adult: "중장년", senior: "어르신" },
  income_level: { low: "형편 어려움", mid: "보통", high: "여유 있음" },
};

export default function Home() {
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const latest = useQuery({ queryKey: ["recommendations", "latest"], queryFn: api.latestRecommendation, retry: false });

  async function generate() {
    const rec = await api.generateRecommendations();
    qc.invalidateQueries({ queryKey: ["recommendations", "latest"] });
    router.push({ pathname: "/recommendation/[id]", params: { id: rec.id } });
  }

  const summary = profile.data
    ? [
        profile.data.age_group ? PROFILE_LABEL.age_group[profile.data.age_group] : null,
        profile.data.income_level ? PROFILE_LABEL.income_level[profile.data.income_level] : null,
        profile.data.region_sido,
      ]
        .filter(Boolean)
        .join(" · ") || "아직 정보가 부족해요 — 포용이와 대화해 보세요"
    : "불러오는 중...";

  return (
    <Screen>
      <ScrollView contentContainerClassName="p-5 gap-5">
        <Card>
          <AppText variant="base" muted>
            내 상황 요약
          </AppText>
          <AppText variant="subtitle" bold className="mt-1">
            {summary}
          </AppText>
          <View className="mt-4">
            <Link href="/(tabs)/chat" asChild>
              <View>
                <PrimaryButton label="포용이와 상담하기" />
              </View>
            </Link>
          </View>
        </Card>

        <Heading>나에게 맞는 정책</Heading>
        {latest.isLoading ? (
          <ActivityIndicator color="#0E7C6B" />
        ) : latest.data && latest.data.recommendations.length > 0 ? (
          <View className="gap-3">
            {latest.data.recommendations.map((r) => (
              <PolicyCard key={r.product.code} product={r.product} score={r.match_score} reasons={r.reasons} />
            ))}
            {latest.data.gap_signal ? (
              <AppText variant="base" className="text-amber-700 dark:text-amber-400 px-1">
                ⚠ {latest.data.gap_signal}
              </AppText>
            ) : null}
          </View>
        ) : (
          <Card className="border-dashed items-center gap-3">
            <AppText variant="base" muted className="text-center">
              아직 추천이 없어요. 포용이와 조금 더 이야기하거나, 지금 바로 받아볼 수 있어요.
            </AppText>
            <PrimaryButton label="추천 받아보기" onPress={generate} />
          </Card>
        )}

        <AppText variant="hint" muted className="text-center mt-2">
          궁금하면 서민금융통합지원센터 ☎ 1397 로도 문의하실 수 있어요.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
