import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { PolicyCard } from "@/components/PolicyCard";
import { AppText, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useFontSize } from "@/lib/ui";

const FILTERS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: "전체" },
  { key: "loan", label: "대출" },
  { key: "savings", label: "저축·자산형성" },
  { key: "debt_relief", label: "채무조정" },
];

export default function Policies() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { fs } = useFontSize();
  const { data, isLoading } = useQuery({
    queryKey: ["policies", category ?? "all"],
    queryFn: () => api.listPolicies(category),
  });

  return (
    <Screen>
      <View className="flex-row flex-wrap gap-2 px-4 py-3">
        {FILTERS.map((f) => {
          const active = f.key === category;
          return (
            <Pressable
              key={f.label}
              onPress={() => setCategory(f.key)}
              className={`px-3 py-2 rounded-full ${active ? "bg-brand" : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"}`}
            >
              <Text
                className={active ? "text-white" : "text-gray-700 dark:text-gray-200"}
                style={{ fontSize: fs(16), fontWeight: active ? "700" : "400" }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#0E7C6B" className="mt-8" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(p) => p.code}
          renderItem={({ item }) => <PolicyCard product={item} />}
          contentContainerClassName="px-4 pb-6 gap-3"
          ListEmptyComponent={
            <AppText variant="base" muted className="text-center mt-10">
              표시할 상품이 없어요.
            </AppText>
          }
        />
      )}
    </Screen>
  );
}
