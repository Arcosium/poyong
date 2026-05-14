import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, View } from "react-native";

import { AppText, Card, ChipRow, Heading, Screen } from "@/components/ui";
import { api, type UserProfile } from "@/lib/api";
import { type FontScale, type ThemeMode, useAppStore } from "@/lib/store";

type AgeGroup = "youth" | "adult" | "senior";
type IncomeLevel = "low" | "mid" | "high";

const AGE_OPTS: { v: AgeGroup; label: string }[] = [
  { v: "youth", label: "청년" },
  { v: "adult", label: "중장년" },
  { v: "senior", label: "어르신" },
];
const INCOME_OPTS: { v: IncomeLevel; label: string }[] = [
  { v: "low", label: "넉넉지 않아요" },
  { v: "mid", label: "보통이에요" },
  { v: "high", label: "여유 있어요" },
];
const EMPLOYMENT_OPTS: { v: string; label: string }[] = [
  { v: "employed", label: "직장 다녀요" },
  { v: "self_employed", label: "자영업이에요" },
  { v: "part_time", label: "임시·일용직" },
  { v: "unemployed", label: "지금은 일을 안 해요" },
];
const LITERACY_OPTS: { v: string; label: string }[] = [
  { v: "1", label: "1 · 많이 어려워요" },
  { v: "2", label: "2" },
  { v: "3", label: "3 · 보통" },
  { v: "4", label: "4" },
  { v: "5", label: "5 · 잘 알아요" },
];
const FONT_OPTS: { v: FontScale; label: string }[] = [
  { v: "normal", label: "보통" },
  { v: "large", label: "크게" },
  { v: "xlarge", label: "아주 크게" },
];
const THEME_OPTS: { v: ThemeMode; label: string }[] = [
  { v: "system", label: "기기 설정" },
  { v: "light", label: "밝게" },
  { v: "dark", label: "어둡게" },
];
const SIDO = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
];

function RegionPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="gap-2">
      <AppText variant="base" muted>
        사는 지역 (시·도)
      </AppText>
      <Pressable onPress={() => setOpen(true)} className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3">
        <AppText variant="body">{value ?? "선택 안 함 — 누르면 고를 수 있어요"}</AppText>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="bg-white dark:bg-gray-800 rounded-t-3xl p-5 max-h-[70%]" onPress={() => {}}>
            <View className="self-center w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
            <Heading>지역 선택</Heading>
            <FlatList
              data={SIDO}
              keyExtractor={(s) => s}
              className="mt-2"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  className={`py-3 px-2 rounded-xl ${item === value ? "bg-brand-light" : ""}`}
                >
                  <AppText variant="body" className={item === value ? "text-brand-dark" : undefined}>
                    {item}
                  </AppText>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

export default function Profile() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const patch = useMutation({
    mutationFn: (p: Partial<UserProfile>) => api.patchProfile(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const fontScale = useAppStore((s) => s.fontScale);
  const setFontScale = useAppStore((s) => s.setFontScale);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  return (
    <Screen>
      <ScrollView contentContainerClassName="p-4 gap-3">
        <Heading>내 정보</Heading>
        <AppText variant="base" muted>
          입력하실수록 추천이 정확해져요. 언제든 비워두셔도 됩니다. 이름·연락처·상세 주소는 받지 않아요.
        </AppText>

        <ChipRow<AgeGroup>
          title="연령대"
          value={(data?.age_group as AgeGroup | null) ?? null}
          options={AGE_OPTS}
          onChange={(v) => patch.mutate({ age_group: v })}
        />
        <ChipRow<IncomeLevel>
          title="살림 형편"
          value={(data?.income_level as IncomeLevel | null) ?? null}
          options={INCOME_OPTS}
          onChange={(v) => patch.mutate({ income_level: v })}
        />
        <ChipRow<string>
          title="일하는 형태"
          value={data?.employment ?? null}
          options={EMPLOYMENT_OPTS}
          onChange={(v) => patch.mutate({ employment: v })}
        />
        <RegionPicker value={data?.region_sido ?? null} onChange={(v) => patch.mutate({ region_sido: v })} />
        <ChipRow<string>
          title="금융이 얼마나 익숙하세요?"
          value={data?.financial_literacy_score != null ? String(data.financial_literacy_score) : null}
          options={LITERACY_OPTS}
          onChange={(v) => patch.mutate({ financial_literacy_score: Number(v) })}
        />

        <View className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
        <Heading>화면 설정</Heading>
        <ChipRow<FontScale> title="글자 크기" value={fontScale} options={FONT_OPTS} onChange={setFontScale} />
        <ChipRow<ThemeMode> title="밝기 테마" value={themeMode} options={THEME_OPTS} onChange={setThemeMode} />

        <AppText variant="hint" muted className="text-center mt-4">
          FIN:NECT · 익명 식별 · 도움이 필요하면 ☎ 1397 (서민금융통합지원센터)
        </AppText>
      </ScrollView>
    </Screen>
  );
}
