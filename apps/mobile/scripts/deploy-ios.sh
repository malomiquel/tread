#!/usr/bin/env bash
# Release build installed on the connected iPhone (or the one given as DEVICE_ID=...).
# -allowProvisioningUpdates renews the free signing profile once it has expired (7 days).
set -euo pipefail
cd "$(dirname "$0")/.."
# The app lives in apps/mobile; dependencies are installed once, flat, at the
# root of the monorepo, where pnpm keeps its record of the last install.
ROOT="$(cd ../.. && pwd)"

DEVICE_ID="${DEVICE_ID:-$(xcrun devicectl list devices 2>/dev/null | grep physical | grep available | grep -oE '[0-9A-F]{8}-[0-9A-F]{16}' | head -1 || true)}"
if [ -z "$DEVICE_ID" ]; then
  echo "No iPhone available: plug it in (or join the same Wi-Fi) and unlock it." >&2
  exit 1
fi
BUNDLE_ID="$(node -p "require('./app.json').expo.ios.bundleIdentifier")"
# Signing team (free Apple account): prebuild does not write it into the project.
TEAM_ID="${TEAM_ID:-RJPC9JP6NY}"

# A free team cannot sign iCloud, and the precompiled expo modules were built by
# an older swift than the installed xcode accepts: both switches go with every prebuild.
export TREAD_NO_ICLOUD=1
export EXPO_USE_PRECOMPILED_MODULES=0

[ -d "$ROOT/node_modules" ] || (cd "$ROOT" && pnpm install)
# The native project is generated, so it goes stale: a new widget file, a changed
# app.json or a new dependency is not in it until prebuild runs again. The marker
# records when it last did; anything it is older than sends the project back
# through a clean prebuild. A missing workspace means an incomplete project.
# A fresh install counts too (pnpm rewrites node_modules/.modules.yaml): pod install
# copies files into node_modules (expo-sqlite's sqlite3.c/.h), which a reinstall wipes.
MARKER=ios/.prebuilt
if [ ! -d ios/Tread.xcworkspace ] || [ ! -f "$MARKER" ] \
  || [ -n "$(find targets app.json app.config.js package.json patches "$ROOT/node_modules/.modules.yaml" -newer "$MARKER" -print -quit 2>/dev/null)" ]; then
  echo "› Generating the native project"
  npx expo prebuild -p ios --clean
  touch "$MARKER"
fi

echo "› Release build for $DEVICE_ID"
# What is left once compiler warnings are off comes from the pods and from Hermes
# reading the bundle (a global such as _WORKLET "not declared", three lines each),
# and from build phases that cannot say when they have nothing to do. None is ours.
# awk rather than grep -v: grep exits 1 when it prints nothing, which pipefail
# would turn into a failed build.
xcodebuild -workspace ios/Tread.xcworkspace -scheme Tread -configuration Release \
  -destination "id=$DEVICE_ID" -derivedDataPath ios/build -allowProvisioningUpdates -quiet \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic \
  GCC_WARN_INHIBIT_ALL_WARNINGS=YES SWIFT_SUPPRESS_WARNINGS=YES 2>&1 \
  | awk '
      skip > 0 { skip--; next }
      /main\.jsbundle:[0-9]+:[0-9]+: warning:/ { skip = 2; next }
      /Run script build phase .* will be run during every build/ { next }
      /not stripping binary because it is signed/ { next }
      /libtool: warning: .* has no symbols/ { next }
      { print }
    '

echo "› Installing"
xcrun devicectl device install app --device "$DEVICE_ID" ios/build/Build/Products/Release-iphoneos/Tread.app
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"
