#!/usr/bin/env bash
# 포용이 Android APK 빌드 — 한 방 자동화 (sudo/docker 불필요)
#
# 사용법:
#   ./build_apk.sh              # debug APK 빌드 + Google Drive 'apk' 폴더 업로드
#   POYONG_DRIVE_UPLOAD=0 ./build_apk.sh   # 업로드 생략
#
# 방식: aarch64 호스트에서 JDK17·Gradle 은 네이티브로 돌리고, x86_64 전용인
# aapt2 만 qemu-user-static 으로 에뮬레이션한다(~/android-build/native/ 에 준비됨).
# docker QEMU 이미지 빌드가 필요 없어 sudo 권한 없이 동작한다.
#
# 산출물: ./Poyong.apk (+ Drive apk/Poyong.apk)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="${HERE}/apps/web-prototype"
NATIVE="${HOME}/android-build/native"   # jdk17 / sdk / aapt2-qemu (README 참고)
APK_OUT="${HERE}/Poyong.apk"

log(){ printf '\033[1;36m[poyong-apk]\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31m[poyong-apk] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$WEB_DIR" ] || die "웹 디렉토리 없음: $WEB_DIR"
[ -x "${NATIVE}/aapt2-wrap/aapt2" ] || die "네이티브 빌드 툴체인 없음: ${NATIVE} (jdk17/sdk/aapt2-wrap)"

# ① Next.js 정적 빌드 (out/) — .env.local 의 NEXT_PUBLIC_* 가 이 시점에 번들로 인라인됨
log "① next build (정적 export)…"
( cd "$WEB_DIR" && npm run build >/dev/null ) || die "next build 실패"

# ② Capacitor sync — out/ 을 android assets 로 복사
log "② npx cap sync android…"
( cd "$WEB_DIR" && npx cap sync android >/dev/null ) || die "cap sync 실패"

# ③ Gradle assembleDebug — 네이티브 JDK17 + qemu aapt2
log "③ gradlew assembleDebug…"
export JAVA_HOME="${NATIVE}/jdk17"
export ANDROID_HOME="${NATIVE}/sdk"
cd "${WEB_DIR}/android"
echo "sdk.dir=${ANDROID_HOME}" > local.properties
# AGP 는 오버라이드 경로의 파일명이 정확히 'aapt2' 여야 받아들인다 (aapt2-wrap/aapt2)
./gradlew --no-daemon assembleDebug \
  -Pandroid.aapt2FromMavenOverride="${NATIVE}/aapt2-wrap/aapt2"

APK_SRC="app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK_SRC" ] || die "APK 미생성: $APK_SRC"
cp -f "$APK_SRC" "$APK_OUT"
log "완료: $(ls -lh "$APK_OUT" | awk '{print $9, "("$5")"}')"

# ④ Google Drive 업로드 (rclone gdrive: 리모트, best-effort)
if [ "${POYONG_DRIVE_UPLOAD:-1}" != "0" ]; then
  log "④ Google Drive 업로드 (apk/Poyong.apk)…"
  rclone copyto "$APK_OUT" "gdrive:apk/Poyong.apk" --progress \
    || log "⚠ Drive 업로드 실패 — 빌드 자체는 정상. 수동: rclone copyto $APK_OUT gdrive:apk/Poyong.apk"
else
  log "POYONG_DRIVE_UPLOAD=0 → Drive 업로드 생략."
fi
