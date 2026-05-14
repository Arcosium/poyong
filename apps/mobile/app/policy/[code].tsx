import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Linking, ScrollView, View } from "react-native";

import { GlossaryText } from "@/components/GlossaryTerm";
import { AppText, Card, Heading, PrimaryButton, Screen } from "@/components/ui";
import { api } from "@/lib/api";

function CheckMark({ passed }: { passed: boolean | null }) {
  if (passed === true) return <AppText variant="subtitle" className="text-green-600 dark:text-green-400">✓</AppText>;
  if (passed === false) return <AppText variant="subtitle" className="text-red-500 dark:text-red-400">✗</AppText>;
  return <AppText variant="subtitle" className="text-amber-500 dark:text-amber-400">?</AppText>;
}

export default function PolicyDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["policy", code],
    queryFn: () => api.getPolicy(code!),
    enabled: !!code,
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

  const badge =
    data.eligible === true
      ? { text: "신청 자격이 될 가능성이 높아요", cls: "bg-green-50 dark:bg-green-900/30" }
      : data.eligible === false
        ? { text: "현재 자격이 안 맞을 수 있어요", cls: "bg-red-50 dark:bg-red-900/30" }
        : { text: "몇 가지 확인이 필요해요", cls: "bg-amber-50 dark:bg-amber-900/30" };

  return (
    <Screen edges={["bottom"]} className="bg-white dark:bg-gray-900">
      <ScrollView contentContainerClassName="p-5 gap-5">
        <View>
          <Heading>{data.name}</Heading>
          <AppText variant="base" muted className="mt-1">
            {data.issuer}
          </AppText>
          {data.summary ? (
            <View className="mt-3">
              <GlossaryText text={data.summary} variant="body" />
            </View>
          ) : null}
        </View>

        <View className={`rounded-2xl p-4 ${badge.cls}`}>
          <AppText variant="base" bold>
            {badge.text}
          </AppText>
        </View>

        {/* 자격 체크리스트 — 사용자 프로필로 자동 ✓/✗/? */}
        <View className="gap-2">
          <Heading>자격 요건 체크</Heading>
          {data.eligibility_check.length === 0 ? (
            <AppText variant="base" muted>
              특별한 제한 조건이 없어요.
            </AppText>
          ) : (
            data.eligibility_check.map((c, i) => (
              <View key={i} className="flex-row gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <CheckMark passed={c.passed} />
                <View className="flex-1">
                  <GlossaryText text={c.rule} variant="base" />
                  {c.detail ? (
                    <AppText variant="hint" muted className="mt-0.5">
                      {c.detail}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {data.required_documents.length > 0 ? (
          <View className="gap-2">
            <Heading>필요 서류</Heading>
            <Card className="gap-1">
              {data.required_documents.map((d, i) => (
                <AppText key={i} variant="base">
                  · {d}
                </AppText>
              ))}
            </Card>
          </View>
        ) : null}

        <PrimaryButton label="신청 페이지로 이동" onPress={() => Linking.openURL(data.application_url)} />
        <AppText variant="hint" muted className="text-center">
          신청 절차가 헷갈리시면 서민금융통합지원센터 ☎ 1397 로 문의하세요.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
