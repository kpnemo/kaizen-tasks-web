#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): reads the tool input JSON from stdin and runs prettier on the
# edited file when it is inside this repo, has a formattable extension, and is not generated.
set -uo pipefail
cd "$(dirname "$0")/.."

# Only read stdin when it is not a terminal, so a manual, unpiped run never hangs waiting for input.
[ -t 0 ] && exit 0

input="$(cat)"
file="$(printf '%s' "$input" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try { process.stdout.write(String(JSON.parse(s).tool_input?.file_path ?? "")); } catch {}
  });
')"
[ -z "$file" ] && exit 0

repo="$(pwd -P)"
dir="$(cd "$(dirname "$file")" 2>/dev/null && pwd -P)" || exit 0
abs="$dir/$(basename "$file")"
case "$abs" in "$repo"/*) ;; *) exit 0 ;; esac
[ -f "$abs" ] || exit 0

rel="${abs#"$repo"/}"
case "$rel" in
  node_modules/*|dist/*|.mock/*|src/api/types.ts|src/api/openapi.json|src/components/ui/*|CHANGELOG.md) exit 0 ;;
esac
case "$rel" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.css|*.md|*.yml|*.yaml) ;;
  *) exit 0 ;;
esac

npx prettier --write "$abs" >/dev/null 2>&1 || true
exit 0
