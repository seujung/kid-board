#!/bin/zsh
# Install the LaunchAgent. Usage: install-agent.sh [--print]
# --print writes the filled plist to stdout and changes nothing.
set -u

SCRIPT_DIR="${0:A:h}"
CONFIG="${KIDBOARD_CONFIG:-$SCRIPT_DIR/config.env}"
LABEL="com.kidboard.reinstall"

STATE_DIR="$HOME/Library/Application Support/KidBoardReinstall"
[[ -f "$CONFIG" ]] && source "$CONFIG"

# xml-escape &, <, > for plist strings
esc() { local s="$1"; s="${s//&/&amp;}"; s="${s//</&lt;}"; s="${s//>/&gt;}"; print -r -- "$s"; }

render() {
  local script_path state_dir
  script_path="$(esc "$SCRIPT_DIR/kidboard-reinstall.sh")"
  state_dir="$(esc "$STATE_DIR")"
  local content
  content="$(<"$SCRIPT_DIR/$LABEL.plist.template")"
  content="${content//__SCRIPT_PATH__/$script_path}"
  content="${content//__STATE_DIR__/$state_dir}"
  print -r -- "$content"
}

if [[ "${1:-}" == "--print" ]]; then
  render
  exit 0
fi

DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$STATE_DIR" || exit 1
render > "$DEST" || exit 1
plutil -lint "$DEST" || exit 1

# Idempotent: unload an already-loaded agent first (failure is fine).
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
launchctl bootstrap "gui/$(id -u)" "$DEST" || exit 1
echo "Installed $DEST"
