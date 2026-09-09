#!/usr/bin/env bash
# Polls <base-url>/version.json until its "commit" equals <sha>. Used by promote.yml so the smoke
# package runs against the build under review, never a stale one.
#   scripts/wait-for-version.sh <base-url> <sha> [timeout-seconds=900] [interval-seconds=15]
set -uo pipefail
URL="${1:?base url}"
SHA="${2:?sha}"
TIMEOUT="${3:-900}"
INTERVAL="${4:-15}"
deadline=$((SECONDS + TIMEOUT))

while :; do
  live="$(curl -fsS --max-time 10 -H 'Cache-Control: no-cache' "${URL%/}/version.json" 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).commit??""))}catch{}})')"
  echo "staging=${live:-<none>} want=$SHA"
  if [ "$live" = "$SHA" ]; then
    echo "staging serves $SHA"
    exit 0
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::staging did not serve $SHA within ${TIMEOUT}s (last seen: ${live:-<none>})"
    exit 1
  fi
  sleep "$INTERVAL"
done
