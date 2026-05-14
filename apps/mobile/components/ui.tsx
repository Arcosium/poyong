/**
 * 공용 UI 프리미티브 — 화면들이 같은 톤(다크모드·글자 크기·간격)을 쓰도록.
 * 화면 코드에서 SafeAreaView/Text 를 직접 쓰는 대신 여기 것을 쓴다.
 */
import { ReactNode } from "react";
import { Pressable, Text, type TextProps, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { FONT_BASE, type FontVariant, useFontSize } from "@/lib/ui";

// ── 텍스트 ────────────────────────────────────────────────────────────────────
interface AppTextProps extends TextProps {
  /** 기준 글자 크기. 사용자 글자 배율이 곱해진다. */
  variant?: FontVariant;
  /** true 면 어두운 배경 위 보조 텍스트 색(회색)을 쓴다. */
  muted?: boolean;
  bold?: boolean;
}

export function AppText({ variant = "base", muted, bold, style, className, ...rest }: AppTextProps) {
  const { fs } = useFontSize();
  const colorClass = muted ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-50";
  return (
    <Text
      className={`${colorClass} ${className ?? ""}`}
      style={[{ fontSize: fs(FONT_BASE[variant]), lineHeight: fs(FONT_BASE[variant]) * 1.5, fontWeight: bold ? "700" : "400" }, style]}
      {...rest}
    />
  );
}

export function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <AppText variant="title" bold className={className}>
      {children}
    </AppText>
  );
}

// ── 레이아웃 ──────────────────────────────────────────────────────────────────
export function Screen({
  children,
  edges = ["bottom"],
  className,
}: {
  children: ReactNode;
  edges?: Edge[];
  className?: string;
}) {
  return (
    <SafeAreaView edges={edges} className={`flex-1 bg-gray-50 dark:bg-gray-900 ${className ?? ""}`}>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, className, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View
      className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 ${className ?? ""}`}
      {...rest}
    >
      {children}
    </View>
  );
}

// ── 버튼 ──────────────────────────────────────────────────────────────────────
export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = "filled",
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "filled" | "tinted";
}) {
  const { fs } = useFontSize();
  const base = "rounded-2xl py-4 items-center";
  const cls = disabled
    ? `${base} bg-gray-300 dark:bg-gray-700`
    : variant === "tinted"
      ? `${base} bg-brand-light active:opacity-80`
      : `${base} bg-brand active:opacity-80`;
  const textCls = disabled ? "text-gray-500" : variant === "tinted" ? "text-brand-dark" : "text-white";
  return (
    <Pressable onPress={onPress} disabled={disabled} className={cls}>
      <Text className={textCls} style={{ fontSize: fs(18), fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 토글 칩 한 줄 — 프로필 화면의 선택지(연령대/소득/테마/글자크기 등)에 재사용. */
export function ChipRow<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T | null | undefined;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { fs } = useFontSize();
  return (
    <Card className="gap-2">
      <AppText variant="base" muted>
        {title}
      </AppText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const active = o.v === value;
          return (
            <Pressable
              key={o.v}
              onPress={() => onChange(o.v)}
              className={`px-4 py-2 rounded-full ${active ? "bg-brand" : "bg-gray-100 dark:bg-gray-700"}`}
            >
              <Text
                className={active ? "text-white" : "text-gray-700 dark:text-gray-200"}
                style={{ fontSize: fs(16), fontWeight: active ? "700" : "400" }}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
