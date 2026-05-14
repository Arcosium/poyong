import { Link, Stack } from "expo-router";
import { View } from "react-native";

import { AppText, Heading, PrimaryButton, Screen } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "찾을 수 없어요" }} />
      <Screen edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Heading>여기엔 아무것도 없어요</Heading>
          <AppText variant="body" muted className="text-center">
            주소가 바뀌었거나 잘못 들어오셨을 수 있어요. 홈으로 돌아가서 다시 시작해 주세요.
          </AppText>
          <Link href="/(tabs)" asChild>
            <View className="w-full">
              <PrimaryButton label="홈으로 가기" />
            </View>
          </Link>
        </View>
      </Screen>
    </>
  );
}
