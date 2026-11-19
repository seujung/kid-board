#!/bin/zsh
# Re-sign and reinstall KidBoard on the iPad. Usage: kidboard-reinstall.sh [--force]
# Exit codes: 0 = success or skipped, 1 = failure.
#
# PATH: launchd starts jobs with a minimal PATH, so the Homebrew directories are
# APPENDED. Appending (not prepending) lets test stubs placed in
# KIDBOARD_EXTRA_PATH, or earlier in PATH, win over the real tools.
PATH="${KIDBOARD_EXTRA_PATH:+$KIDBOARD_EXTRA_PATH:}$PATH:/opt/homebrew/bin:/usr/local/bin"
export PATH

set -u

SCRIPT_DIR="${0:A:h}"
CONFIG="${KIDBOARD_CONFIG:-$SCRIPT_DIR/config.env}"

if [[ ! -f "$CONFIG" ]]; then
  print -u2 "config not found: $CONFIG"
  exit 1
fi
source "$CONFIG"

STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/KidBoardReinstall}"
MIN_DAYS="${MIN_DAYS:-5}"
[[ -n "${DEVELOPER_DIR:-}" ]] && export DEVELOPER_DIR

mkdir -p "$STATE_DIR" || exit 1
LOG="$STATE_DIR/reinstall.log"
STATE_FILE="$STATE_DIR/last-install"

log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

for var in PROJECT_DIR DEVICE_ID BUNDLE_ID; do
  if [[ -z "${(P)var:-}" ]]; then
    log "config error: $var is not set"
    exit 1
  fi
done

now=$(date +%s)
if (( ! FORCE )) && [[ -f "$STATE_FILE" ]]; then
  last="$(<"$STATE_FILE")"
  if [[ "$last" == <-> ]] && (( now - last < MIN_DAYS * 86400 )); then
    log "skip: last install $(( (now - last) / 3600 ))h ago, minimum is ${MIN_DAYS} days"
    exit 0
  fi
fi

# run_step <label> <command...>: run a command, append its output to the log.
run_step() {
  local label="$1"; shift
  log "start: $label"
  "$@" >> "$LOG" 2>&1
  local rc=$?
  if (( rc != 0 )); then
    log "FAILED: $label (exit $rc)"
    return 1
  fi
  log "done: $label"
  return 0
}

fail() {
  osascript -e 'display notification "자동 재설치 실패. 로그를 확인하세요." with title "할 일 보드"' >> "$LOG" 2>&1
  exit 1
}

cd "$PROJECT_DIR" || { log "FAILED: cd $PROJECT_DIR"; fail; }

run_step "xcodegen" xcodegen generate --spec "$PROJECT_DIR/project.yml" || fail
run_step "xcodebuild" xcodebuild -project KidBoard.xcodeproj -scheme KidBoard \
  -configuration Release -destination "id=$DEVICE_ID" \
  -derivedDataPath "$STATE_DIR/DerivedData" -allowProvisioningUpdates build || fail
run_step "devicectl install" xcrun devicectl device install app --device "$DEVICE_ID" \
  "$STATE_DIR/DerivedData/Build/Products/Release-iphoneos/KidBoard.app" || fail
run_step "devicectl launch" xcrun devicectl device process launch --device "$DEVICE_ID" \
  --terminate-existing "$BUNDLE_ID" || fail

print -r -- "$(date +%s)" > "$STATE_FILE"
log "success: reinstalled"
exit 0
