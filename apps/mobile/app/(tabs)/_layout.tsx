import { Tabs } from "expo-router";
import { Text } from "react-native";

import { useResolvedScheme } from "@/lib/ui";

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 18 }}>{label}</Text>;
}

export default function TabsLayout() {
  const scheme = useResolvedScheme();
  const dark = scheme === "dark";
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0E7C6B" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#0E7C6B",
        tabBarInactiveTintColor: dark ? "#9CA3AF" : "#6B7280",
        tabBarStyle: {
          backgroundColor: dark ? "#1F2937" : "#FFFFFF",
          borderTopColor: dark ? "#374151" : "#E5E7EB",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "홈", tabBarIcon: () => <TabIcon label="🏠" /> }} />
      <Tabs.Screen name="chat" options={{ title: "포용이 상담", tabBarIcon: () => <TabIcon label="💬" /> }} />
      <Tabs.Screen name="policies" options={{ title: "정책 둘러보기", tabBarIcon: () => <TabIcon label="📋" /> }} />
      <Tabs.Screen name="profile" options={{ title: "내 정보", tabBarIcon: () => <TabIcon label="👤" /> }} />
    </Tabs>
  );
}
