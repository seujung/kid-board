#!/bin/zsh
# Re-sign and reinstall KidBoard on the iPad. Usage: kidboard-reinstall.sh [--force]
# Exit codes: 0 = success or skipped, 1 = failure.
# Every failure shows a Mac notification and writes the reason to the log
# (or to stderr when the log is not available yet).
#
# PATH: launchd starts jobs with a minimal PATH, so the Homebrew directories are
# APPENDED. Appending (not prepending) lets test stubs placed in
# KIDBOARD_EXTRA_PATH, or earlier in PATH, win over the real tools.
PATH="${KIDBOARD_EXTRA_PATH:+$KIDBOARD_EXTRA_PATH:}$PATH:/opt/homebrew/bin:/usr/local/bin"
export PATH

set -u

SCRIPT_DIR="${0:A:h}"
CONFIG="${KIDBOARD_CONFIG:-$SCRIPT_DIR/config.env}"
LOG=""

# Step time limits in seconds. KIDBOARD_STEP_TIMEOUT overrides all of them (tests).
TIMEOUT_XCODEGEN=300
TIMEOUT_BUILD=1800
TIMEOUT_INSTALL=600
TIMEOUT_LAUNCH=120
# The freshly built profile must stay valid at least this many days.
MIN_PROFILE_DAYS=6

# log <message>: append to the log, or print to stderr while there is no log.
log() {
  local line="$(date '+%Y-%m-%d %H:%M:%S') $*"
  if [[ -n "$LOG" ]]; then
    print -r -- "$line" >> "$LOG" || print -u2 -r -- "$line"
  else
    print -u2 -r -- "$line"
  fi
}

# fail <reason>: record the reason, show a Mac notification, exit 1.
fail() {
  log "FAILED: $*"
  local note='display notification "자동 재설치 실패. 로그를 확인하세요." with title "할 일 보드"'
  if [[ -n "$LOG" ]]; then
    osascript -e "$note" >> "$LOG" 2>&1
  else
    osascript -e "$note" >&2
  fi
  exit 1
}

if [[ ! -f "$CONFIG" ]]; then
  fail "config not found: $CONFIG"
fi
source "$CONFIG" || fail "config could not be read: $CONFIG"

STATE_DIR="${STATE_DIR:-$HOME/Library/Application Support/KidBoardReinstall}"
MIN_DAYS="${MIN_DAYS:-5}"
[[ -n "${DEVELOPER_DIR:-}" ]] && export DEVELOPER_DIR

mkdir -p "$STATE_DIR" || fail "cannot create state directory: $STATE_DIR"
LOG="$STATE_DIR/reinstall.log"
STATE_FILE="$STATE_DIR/last-install"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

for var in PROJECT_DIR DEVICE_ID BUNDLE_ID; do
  [[ -n "${(P)var:-}" ]] || fail "config error: $var is not set"
done

now=$(date +%s)
if (( ! FORCE )) && [[ -f "$STATE_FILE" ]]; then
  last="$(<"$STATE_FILE")"
  # A last-install time in the future (clock change, bad file) counts as stale.
  if [[ "$last" == <-> ]] && (( last <= now && now - last < MIN_DAYS * 86400 )); then
    log "skip: last install $(( (now - last) / 3600 ))h ago, minimum is ${MIN_DAYS} days"
    exit 0
  fi
fi

# with_timeout <seconds> <command...>: run the command in its own process group.
# After <seconds> the whole group gets TERM, then KILL up to 5 s later, and the exit
# code is 124. macOS has no timeout(1), so this uses the system perl.
with_timeout() {
  local secs="${KIDBOARD_STEP_TIMEOUT:-$1}"; shift
  perl -e '
    my $secs = shift @ARGV;
    my $pid = fork;
    die "fork: $!" unless defined $pid;
    if ($pid == 0) { setpgrp(0, 0); exec @ARGV or exit 127; }
    local $SIG{ALRM} = sub {
      kill "TERM", -$pid;
      for (1 .. 10) { last if waitpid($pid, 1) > 0; select(undef, undef, undef, 0.5); }
      kill "KILL", -$pid;
      exit 124;
    };
    alarm $secs;
    waitpid $pid, 0;
    exit(($? & 127) ? 128 + ($? & 127) : $? >> 8);
  ' "$secs" "$@"
}

# run_step <label> <seconds> <command...>: run a command with a time limit and
# append its output to the log.
run_step() {
  local label="$1" secs="$2"; shift 2
  log "start: $label"
  with_timeout "$secs" "$@" >> "$LOG" 2>&1
  local rc=$?
  if (( rc == 124 )); then
    log "timed out: $label after ${KIDBOARD_STEP_TIMEOUT:-$secs}s"
    return 1
  elif (( rc != 0 )); then
    log "exit $rc: $label"
    return 1
  fi
  log "done: $label"
  return 0
}

cd "$PROJECT_DIR" || fail "cd $PROJECT_DIR"

APP="$STATE_DIR/DerivedData/Build/Products/Release-iphoneos/KidBoard.app"
PROFILE_PLIST="$STATE_DIR/embedded-profile.plist"

run_step "xcodegen" "$TIMEOUT_XCODEGEN" xcodegen generate --spec "$PROJECT_DIR/project.yml" || fail "xcodegen"
# Build for any iOS device. DEVICE_ID is the devicectl (CoreDevice) identifier,
# which xcodebuild -destination does not always accept.
run_step "xcodebuild" "$TIMEOUT_BUILD" xcodebuild -project KidBoard.xcodeproj -scheme KidBoard \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$STATE_DIR/DerivedData" -allowProvisioningUpdates build || fail "xcodebuild"

# Xcode may reuse a cached free profile. Refuse to install one that expires soon.
[[ -f "$APP/embedded.mobileprovision" ]] || fail "no embedded.mobileprovision in $APP"
security cms -D -i "$APP/embedded.mobileprovision" > "$PROFILE_PLIST" 2>> "$LOG" ||
  fail "cannot decode embedded.mobileprovision"
expiry="$(plutil -extract ExpirationDate raw -o - "$PROFILE_PLIST" 2>> "$LOG")" ||
  fail "no ExpirationDate in the profile"
expiry_epoch="$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$expiry" +%s 2>> "$LOG")" ||
  fail "cannot parse ExpirationDate: $expiry"
days_left=$(( (expiry_epoch - $(date +%s)) / 86400 ))
log "profile expires $expiry ($days_left days left)"
(( days_left >= MIN_PROFILE_DAYS )) ||
  fail "profile expires in $days_left days (minimum $MIN_PROFILE_DAYS). Xcode did not renew it."

run_step "devicectl install" "$TIMEOUT_INSTALL" xcrun devicectl device install app --device "$DEVICE_ID" \
  "$APP" || fail "devicectl install"
run_step "devicectl launch" "$TIMEOUT_LAUNCH" xcrun devicectl device process launch --device "$DEVICE_ID" \
  --terminate-existing "$BUNDLE_ID" || fail "devicectl launch"

print -r -- "$(date +%s)" > "$STATE_FILE"
log "success: reinstalled"
exit 0
