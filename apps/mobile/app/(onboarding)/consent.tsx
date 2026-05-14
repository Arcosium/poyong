import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText, Heading, PrimaryButton } from "@/components/ui";
import { useAppStore } from "@/lib/store";

export default function Consent() {
  const router = useRouter();
  const setConsentGiven = useAppStore((s) => s.setConsentGiven);
  const [checked, setChecked] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView contentContainerClassName="px-6 py-8 gap-5">
        <Heading>데이터 활용 동의</Heading>
        <AppText variant="body">
          FIN:NECT 는 어떤 도움이 어디서 얼마나 필요한지를 정부가 알 수 있도록, 여러분이 무엇을 물었고 어떤 상품을
          안내받았는지를 <AppText variant="body" bold>익명으로</AppText> 모읍니다.
        </AppText>

        <View className="bg-brand-light dark:bg-brand-dark/30 rounded-2xl p-5 gap-2">
          <AppText variant="base">· 수집: 상담 주제, 시·도 단위 지역, 연령대 등 (이름·연락처·정확한 주소 ✕)</AppText>
          <AppText variant="base">· 목적: 정책 사각지대 발견, 상품 개선 근거 마련</AppText>
          <AppText variant="base">· 보관: 5명 미만 집단은 통계에서 제외 (재식별 방지)</AppText>
        </View>

        <Pressable onPress={() => setChecked((v) => !v)} className="flex-row items-center gap-3 py-2">
          <View
            className={`w-7 h-7 rounded-md border-2 ${checked ? "bg-brand border-brand" : "border-gray-400 dark:border-gray-500"} items-center justify-center`}
          >
            {checked ? <AppText variant="base" bold className="text-white">✓</AppText> : null}
          </View>
          <AppText variant="body" className="flex-1">
            위 내용을 이해했고, 익명 통계 제공에 동의합니다.
          </AppText>
        </Pressable>

        <PrimaryButton
          label="동의하고 시작"
          disabled={!checked}
          onPress={() => {
            setConsentGiven(true);
            router.replace("/(tabs)");
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
