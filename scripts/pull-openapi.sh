#!/usr/bin/env bash
# Copies the API contract into src/api/openapi.json and regenerates src/api/types.ts.
#   scripts/pull-openapi.sh [ref]              download from GitHub (default ref: develop)
#   scripts/pull-openapi.sh --local <path>     copy from a local checkout, e.g. ../backend/openapi.json
#   scripts/pull-openapi.sh [ref] --check      compare only: warn when the copy is behind, never fail
#   scripts/pull-openapi.sh --local <p> --check
set -uo pipefail
cd "$(dirname "$0")/.."

REF="develop"
LOCAL=""
CHECK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --local) LOCAL="${2:-}"; shift 2 ;;
    --check) CHECK=1; shift ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) REF="$1"; shift ;;
  esac
done

DEST="src/api/openapi.json"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [ -n "$LOCAL" ]; then
  if [ ! -f "$LOCAL" ]; then
    echo "pull-openapi: no file at $LOCAL" >&2
    exit 1
  fi
  cp "$LOCAL" "$TMP"
  SOURCE="$LOCAL"
else
  SOURCE="https://raw.githubusercontent.com/kpnemo/kaizen-tasks-api/$REF/openapi.json"
  if ! curl -fsSL "$SOURCE" -o "$TMP"; then
    if [ "$CHECK" = 1 ]; then
      echo "::warning::pull-openapi: could not download $SOURCE; drift check skipped"
      exit 0
    fi
    echo "pull-openapi: could not download $SOURCE" >&2
    exit 1
  fi
fi

if ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$TMP" 2>/dev/null; then
  echo "pull-openapi: $SOURCE is not valid JSON" >&2
  [ "$CHECK" = 1 ] && exit 0
  exit 1
fi

if [ "$CHECK" = 1 ]; then
  if cmp -s "$TMP" "$DEST"; then
    echo "pull-openapi: $DEST matches $SOURCE"
  else
    echo "::warning::pull-openapi: $DEST is behind $SOURCE. Run: npm run api:pull (or npm run api:pull -- --local ../backend/openapi.json) and commit both files."
  fi
  exit 0
fi

cp "$TMP" "$DEST"
echo "pull-openapi: wrote $DEST from $SOURCE"
npm run api:types
