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
  unset STUB_FAIL
}

teardown() { rm -rf "$TMP"; }

run_script() { zsh "$SCRIPT" "$@" >"$TMP/out.txt" 2>&1; RC=$?; }

report() { # name, condition-result (0 = pass)
  if [[ $2 -eq 0 ]]; then print "PASS $1"; else print "FAIL $1"; FAILED=1; [[ -f "$TMP/out.txt" ]] && sed 's/^/    /' "$TMP/out.txt"; fi
}

four_commands() {
  local -a lines; lines=("${(@f)$(<"$STUB_LOG")}")
  [[ ${#lines} -eq 4 ]] &&
  [[ "$lines[1]" == xcodegen\ generate* ]] &&
  [[ "$lines[2]" == xcodebuild\ * ]] &&
  [[ "$lines[3]" == xcrun\ devicectl\ device\ install\ app* ]] &&
  [[ "$lines[4]" == xcrun\ devicectl\ device\ process\ launch* ]]
}

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
  [[ $RC -eq 0 ]] && four_commands && [[ "$(<"$TMP/state/last-install")" -gt $old ]]
  report test_runs_when_old $?; teardown
}

test_runs_when_no_state() {
  setup
  run_script
  [[ $RC -eq 0 ]] && four_commands && [[ -s "$TMP/state/last-install" ]]
  report test_runs_when_no_state $?; teardown
}

test_force_ignores_recent() {
  setup
  print $(( $(now) )) > "$TMP/state/last-install"
  run_script --force
  [[ $RC -eq 0 ]] && four_commands
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

test_skips_when_recent
test_runs_when_old
test_runs_when_no_state
test_force_ignores_recent
test_install_failure
exit $FAILED
