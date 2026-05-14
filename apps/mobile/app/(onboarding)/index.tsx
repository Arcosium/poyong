import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-brand">
      <View className="flex-1 justify-between px-6 py-10">
        <View className="mt-12">
          <Text className="text-white text-4xl font-bold">FIN:NECT</Text>
          <Text className="text-brand-light text-xl mt-3 leading-8">
            금융이 어렵게 느껴지셔도 괜찮아요.{"\n"}'포용이'가 상황을 듣고, 받을 수 있는 정책을 함께 찾아드려요.
          </Text>
        </View>

        <View className="bg-white/10 rounded-2xl p-5">
          <Text className="text-white text-base leading-7">
            · 이름·주민번호 같은 개인정보는 받지 않아요.{"\n"}
            · 회원가입 없이 바로 시작할 수 있어요.{"\n"}
            · 대화 내용은 익명으로만 통계에 쓰여요.
          </Text>
        </View>

        <Link href="/(onboarding)/consent" asChild>
          <Pressable className="bg-white rounded-2xl py-5 items-center active:opacity-80">
            <Text className="text-brand-dark text-xl font-bold">시작하기</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}
