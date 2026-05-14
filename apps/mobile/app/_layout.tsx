import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAppStore } from "@/lib/store";
import { applyColorScheme, useResolvedScheme } from "@/lib/ui";

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );

  // 사용자가 고른 테마(라이트/다크/시스템)를 NativeWind 전역 색상 스킴에 반영
  const themeMode = useAppStore((s) => s.themeMode);
  useEffect(() => applyColorScheme(themeMode), [themeMode]);
  const scheme = useResolvedScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#0E7C6B" },
            headerTintColor: "#fff",
            contentStyle: { backgroundColor: scheme === "dark" ? "#111827" : "#F9FAFB" },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="policy/[code]" options={{ title: "상품 자세히 보기" }} />
          <Stack.Screen name="recommendation/[id]" options={{ title: "추천 사유" }} />
          <Stack.Screen name="+not-found" options={{ title: "페이지를 찾을 수 없어요" }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
