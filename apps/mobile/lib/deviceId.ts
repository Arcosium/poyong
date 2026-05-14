/**
 * 익명 디바이스 ID — 회원가입 없이 같은 기기를 알아보기 위한 식별자.
 * 우선 expo-application 의 OS 제공 식별자를 쓰고, 없으면 직접 UUID 를 만들어
 * expo-secure-store 에 영속 저장한다. (백엔드에서 다시 HMAC 해시되어 저장됨)
 */
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "finnect.deviceId";

function uuidv4(): string {
  // crypto.randomUUID 가 없을 수 있는 RN 환경 대비 폴백
  // @ts-ignore
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  const cached = await SecureStore.getItemAsync(KEY);
  if (cached) return cached;

  let id: string | null = null;
  try {
    id =
      Platform.OS === "android"
        ? Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();
  } catch {
    id = null;
  }
  if (!id) id = uuidv4();

  await SecureStore.setItemAsync(KEY, id);
  return id;
}
