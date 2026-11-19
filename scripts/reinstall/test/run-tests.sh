#!/bin/zsh
# Stub-based tests for kidboard-reinstall.sh. Run: zsh scripts/reinstall/test/run-tests.sh
setopt null_glob
HERE="${0:A:h}"
SCRIPT="$HERE/../kidboard-reinstall.sh"
FAILED=0
TMP=""

setup() {
  TMP="$(mktemp -d)"
  export STUB_LOG="$TMP/stub.log"
  : > "$STUB_LOG"
  mkdir -p "$TMP/project" "$TMP/state"
  cat > "$TMP/config.env" <<CFG
PROJECT_DIR="$TMP/project"
DEVICE_ID="TEST-DEVICE"
BUNDLE_ID="com.example.kidboard"
STATE_DIR="$TMP/state"
MIN_DAYS=5
CFG
  export KIDBOARD_CONFIG="$TMP/config.env"
  export KIDBOARD_EXTRA_PATH="$HERE/stubs"
  unset STUB_FAIL STUB_SLEEP STUB_EXPIRY_DAYS KIDBOARD_STEP_TIMEOUT
}

teardown() { rm -rf "$TMP"; }

run_script() { zsh "$SCRIPT" "$@" >"$TMP/out.txt" 2>&1; RC=$?; }

report() { # name, condition-result (0 = pass)
  if [[ $2 -eq 0 ]]; then print "PASS $1"; else print "FAIL $1"; FAILED=1; [[ -f "$TMP/out.txt" ]] && sed 's/^/    /' "$TMP/out.txt"; fi
}

# The full successful run: generate, build for any iOS device, read the built
# profile, then install and launch on DEVICE_ID.
all_commands() {
  local -a lines; lines=("${(@f)$(<"$STUB_LOG")}")
  [[ ${#lines} -eq 5 ]] &&
  [[ "$lines[1]" == xcodegen\ generate* ]] &&
  [[ "$lines[2]" == xcodebuild\ * ]] &&
  [[ "$lines[2]" == *"-destination generic/platform=iOS "* ]] &&
  [[ "$lines[2]" != *"id=TEST-DEVICE"* ]] &&
  [[ "$lines[3]" == security\ cms\ -D\ -i\ *embedded.mobileprovision ]] &&
  [[ "$lines[4]" == "xcrun devicectl device install app --device TEST-DEVICE "* ]] &&
  [[ "$lines[5]" == "xcrun devicectl device process launch --device TEST-DEVICE "* ]]
}

notified() { grep -q '^osascript ' "$STUB_LOG"; }

now() { date +%s; }

test_skips_when_recent() {
  setup
  print $(( $(now) - 4*86400 )) > "$TMP/state/last-install"
  local before; before="$(<"$TMP/state/last-install")"
  run_script
  [[ $RC -eq 0 && ! -s "$STUB_LOG" && "$(<"$TMP/state/last-install")" == "$before" ]]
  report test_skips_when_recent $?; teardown
}

test_runs_when_old() {
  setup
  local old=$(( $(now) - 5*86400 ))
  print $old > "$TMP/state/last-install"
  run_script
  [[ $RC -eq 0 ]] && all_commands && [[ "$(<"$TMP/state/last-install")" -gt $old ]]
  report test_runs_when_old $?; teardown
}

test_runs_when_no_state() {
  setup
  run_script
  [[ $RC -eq 0 ]] && all_commands && [[ -s "$TMP/state/last-install" ]]
  report test_runs_when_no_state $?; teardown
}

test_force_ignores_recent() {
  setup
  print $(( $(now) )) > "$TMP/state/last-install"
  run_script --force
  [[ $RC -eq 0 ]] && all_commands
  report test_force_ignores_recent $?; teardown
}

test_install_failure() {
  setup
  local old=$(( $(now) - 6*86400 ))
  print $old > "$TMP/state/last-install"
  STUB_FAIL=xcrun run_script
  [[ $RC -eq 1 ]] && grep -q '^osascript ' "$STUB_LOG" && [[ "$(<"$TMP/state/last-install")" == "$old" ]]
  report test_install_failure $?; teardown
}

test_missing_config_notifies() {
  setup
  KIDBOARD_CONFIG="$TMP/missing.env" run_script
  [[ $RC -eq 1 ]] && notified && ! grep -q '^xcodebuild ' "$STUB_LOG"
  report test_missing_config_notifies $?; teardown
}

test_missing_variable_notifies() {
  setup
  grep -v '^DEVICE_ID=' "$TMP/config.env" > "$TMP/partial.env"
  KIDBOARD_CONFIG="$TMP/partial.env" run_script
  [[ $RC -eq 1 ]] && notified && ! grep -q '^xcodebuild ' "$STUB_LOG"
  report test_missing_variable_notifies $?; teardown
}

test_future_last_install_runs() {
  setup
  print $(( $(now) + 10*86400 )) > "$TMP/state/last-install"
  run_script
  [[ $RC -eq 0 ]] && all_commands && (( $(<"$TMP/state/last-install") <= $(now) ))
  report test_future_last_install_runs $?; teardown
}

test_step_timeout_fails() {
  setup
  local start=$(now)
  KIDBOARD_STEP_TIMEOUT=1 STUB_SLEEP=xcodebuild run_script
  local elapsed=$(( $(now) - start ))
  [[ $RC -eq 1 ]] && notified && (( elapsed < 10 )) &&
    ! grep -q '^xcrun ' "$STUB_LOG" && [[ ! -e "$TMP/state/last-install" ]] &&
    grep -q 'timed out' "$TMP/state/reinstall.log"
  report test_step_timeout_fails $?; teardown
}

test_short_profile_expiry_fails() {
  setup
  STUB_EXPIRY_DAYS=3 run_script
  [[ $RC -eq 1 ]] && notified && ! grep -q '^xcrun ' "$STUB_LOG" && [[ ! -e "$TMP/state/last-install" ]]
  report test_short_profile_expiry_fails $?; teardown
}

test_skips_when_recent
test_runs_when_old
test_runs_when_no_state
test_force_ignores_recent
test_install_failure
test_missing_config_notifies
test_missing_variable_notifies
test_future_last_install_runs
test_step_timeout_fails
test_short_profile_expiry_fails
exit $FAILED
