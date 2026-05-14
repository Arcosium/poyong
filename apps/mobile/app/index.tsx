import { Redirect } from "expo-router";

import { useAppStore } from "@/lib/store";

/** 진입점: 동의 전이면 온보딩, 동의했으면 탭으로. */
export default function Index() {
  const consentGiven = useAppStore((s) => s.consentGiven);
  return <Redirect href={consentGiven ? "/(tabs)" : "/(onboarding)"} />;
}
