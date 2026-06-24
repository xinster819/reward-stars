#!/bin/bash
#
# Regenerate App Store screenshots from the iOS Simulator.
#
# No manual tapping: the app's #if DEBUG launch hooks land directly on each
# screen, and UITEST_SEED_FULL seeds the full localized SampleData (events
# included) so dashboards show real points / streak / trend. Fresh install
# PER LANGUAGE so the sample rule/reward names seed localized. SampleData
# only — no real child data — so the output is safe to commit.
#
# Output: docs/appstore/screenshots/<device>/<lang>/NN-name.png at native
# ASC resolution (iPhone 6.9" = 1320x2868, iPad 13" = 2064x2752).
#
# Usage:  bash docs/appstore/generate-screenshots.sh
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$REPO/docs/appstore/screenshots"
DD="$(mktemp -d)/DD"
APP="$DD/Build/Products/Debug-iphonesimulator/RewardingSystem.app"
BID="com.rewardingsystem.app"

# 6.9" iPhone and 13" iPad are the two ASC-required size classes.
IPHONE_NAME="iPhone 17 Pro Max"
IPAD_NAME="iPad Pro 13-inch (M5)"
udid_for() { xcrun simctl list devices available | grep -F "$1 (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/'; }

echo "Building Debug app for the simulator…"
xcodebuild build -project "$REPO/RewardingSystem.xcodeproj" -scheme RewardingSystem \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DD" >/dev/null
test -d "$APP" || { echo "build product missing: $APP"; exit 1; }

shot() {  # udid devlabel code locale name [ENV=VAL ...]
  local udid="$1" devlabel="$2" code="$3" locale="$4" name="$5"; shift 5
  xcrun simctl terminate "$udid" "$BID" >/dev/null 2>&1 || true
  local -a envargs=(); for kv in "$@"; do envargs+=( "SIMCTL_CHILD_$kv" ); done
  env "${envargs[@]}" xcrun simctl launch "$udid" "$BID" \
      -AppleLanguages "($code)" -AppleLocale "$locale" >/dev/null
  sleep 6
  mkdir -p "$OUT/$devlabel/$code"
  xcrun simctl io "$udid" screenshot "$OUT/$devlabel/$code/$name.png" >/dev/null 2>&1
}

capture_lang() {  # udid devlabel code locale
  local udid="$1" devlabel="$2" code="$3" locale="$4"
  echo "  $devlabel / $code"
  xcrun simctl terminate "$udid" "$BID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$udid" "$BID" >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$APP"
  shot "$udid" "$devlabel" "$code" "$locale" "01-welcome"          UITEST_ONBOARDING=1 UITEST_ONBOARDING_PAGE=0
  shot "$udid" "$devlabel" "$code" "$locale" "02-home"            UITEST_SEED_FULL=1 UITEST_RESET=1 UITEST_TAB=0
  shot "$udid" "$devlabel" "$code" "$locale" "03-store"           UITEST_RESET=1 UITEST_TAB=1
  shot "$udid" "$devlabel" "$code" "$locale" "04-parent-overview" UITEST_RESET=1 UITEST_ROLE=parent UITEST_TAB=0
  shot "$udid" "$devlabel" "$code" "$locale" "05-rules"           UITEST_RESET=1 UITEST_ROLE=parent UITEST_TAB=2
}

capture_device() {  # name devlabel
  local udid; udid="$(udid_for "$1")"
  [ -n "$udid" ] || { echo "simulator not found: $1"; exit 1; }
  echo "Device: $1 ($udid)"
  xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
  xcrun simctl status_bar "$udid" override --time "9:41" --batteryState charged \
      --batteryLevel 100 --cellularBars 4 --wifiBars 3 --dataNetwork wifi >/dev/null 2>&1 || true
  capture_lang "$udid" "$devlabel" "zh-Hans" "zh_Hans"
  capture_lang "$udid" "$devlabel" "en"      "en_US"
}

capture_device "$IPHONE_NAME" "iphone-6.9"
capture_device "$IPAD_NAME"   "ipad-13"
echo "Done. $(ls -1 "$OUT"/*/*/*.png | wc -l | tr -d ' ') screenshots in $OUT"
