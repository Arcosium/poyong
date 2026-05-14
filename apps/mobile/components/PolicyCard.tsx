import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { PolicyProduct } from "@/lib/api";
import { useFontSize } from "@/lib/ui";

import { AppText } from "./ui";

const CATEGORY_LABEL: Record<string, string> = {
  loan: "대출",
  savings: "저축·자산형성",
  debt_relief: "채무조정",
};

export function PolicyCard({
  product,
  score,
  reasons,
}: {
  product: PolicyProduct;
  score?: number;
  reasons?: string[];
}) {
  const { fs } = useFontSize();
  return (
    <Link href={{ pathname: "/policy/[code]", params: { code: product.code } }} asChild>
      <Pressable className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 active:opacity-80">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-brand-dark dark:text-brand-light bg-brand-light dark:bg-brand-dark/40 px-2 py-1 rounded-full"
            style={{ fontSize: fs(12) }}
          >
            {CATEGORY_LABEL[product.category] ?? product.category}
          </Text>
          {typeof score === "number" ? (
            <AppText variant="hint" muted>
              적합도 {Math.round(score * 100)}%
            </AppText>
          ) : null}
        </View>
        <AppText variant="subtitle" bold className="mt-2">
          {product.name}
        </AppText>
        {product.summary ? (
          <AppText variant="base" muted className="mt-1" numberOfLines={3}>
            {product.summary}
          </AppText>
        ) : null}
        {reasons && reasons.length > 0 ? (
          <View className="mt-3 gap-1">
            {reasons.slice(0, 2).map((r, i) => (
              <AppText key={i} variant="base" className="text-brand-dark dark:text-brand-light">
                · {r}
              </AppText>
            ))}
          </View>
        ) : null}
        <AppText variant="hint" muted className="mt-3">
          {product.issuer}
        </AppText>
      </Pressable>
    </Link>
  );
}
