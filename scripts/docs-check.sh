#!/usr/bin/env bash
# Docs freshness gate for kaizen-tasks-web. One script, two modes:
#   --hook   Claude Code Stop hook. Exit 2 blocks the stop and feeds the fix list back.
#   --ci     GitHub Actions. BASE_SHA is the PR base or the push's before-SHA. Exit 1 fails the job.
# Rules:
#   A  any code change needs a bullet under [Unreleased] in CHANGELOG.md
#   B  a change to src/api/openapi.json needs src/api/types.ts regenerated with no diff
#   C  a change to a file matching docs/architectural-files.txt needs an ADR in the change
# Escape hatch (hook mode only): after three consecutive blocked stops the hook stops blocking so a
# stuck agent cannot loop forever, but it never reports success: it prints a FAILED banner, writes
# .claude/DOCS-CHECK-FAILED, and CI (same script, --ci) still fails the pull request.
set -uo pipefail
cd "$(dirname "$0")/.."

MODE="${1:---hook}"
COUNTER=".claude/.docs-check-blocks"
MARKER=".claude/DOCS-CHECK-FAILED"
MAX_BLOCKS=3

reset_counter() {
  rm -f "$COUNTER" "$MARKER"
}

# Claude Code feeds the Stop hook a JSON object on stdin, carrying stop_hook_active: true when this
# stop is itself the continuation forced by an earlier block (so consecutive blocks are counted
# within one continuation chain), and false on a genuinely fresh stop, which restarts the count.
# Only read stdin in hook mode and only when it is not a terminal, so a manual, unpiped run
# (`bash scripts/docs-check.sh --hook` at a prompt) never hangs waiting for input; an empty or
# non-JSON payload leaves STOP_HOOK_ACTIVE unset and the counter falls back to its legacy behavior
# of incrementing on every blocked call.
STOP_HOOK_ACTIVE=""
if [ "$MODE" = "--hook" ] && [ ! -t 0 ]; then
  HOOK_INPUT="$(cat || true)"
  if [ -n "$HOOK_INPUT" ]; then
    STOP_HOOK_ACTIVE="$(printf '%s' "$HOOK_INPUT" | node -e '
      let s = "";
      process.stdin.on("data", (d) => (s += d)).on("end", () => {
        try {
          const v = JSON.parse(s).stop_hook_active;
          process.stdout.write(v === true ? "true" : v === false ? "false" : "");
        } catch {
          process.stdout.write("");
        }
      });
    ' 2>/dev/null)"
  fi
fi

root_commit() { git rev-list --max-parents=0 HEAD | tail -n 1; }

changed_files() {
  local base
  if [ "$MODE" = "--ci" ]; then
    base="${BASE_SHA:-}"
    if [ -z "$base" ] || [ "$base" = "0000000000000000000000000000000000000000" ] \
      || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
      base="$(git rev-parse HEAD~1 2>/dev/null || root_commit)"
    fi
    git diff --name-only "$base" HEAD
  else
    if git rev-parse --verify -q origin/develop >/dev/null 2>&1; then
      base="$(git merge-base HEAD origin/develop 2>/dev/null || true)"
    elif git rev-parse --verify -q develop >/dev/null 2>&1; then
      base="$(git merge-base HEAD develop 2>/dev/null || true)"
    else
      base=""
    fi
    # Fall back to the root commit whenever merge-base yields nothing (disjoint history, detached
    # HEAD, no common ancestor) or resolves to something that is not actually a commit here.
    if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
      base="$(root_commit)"
    fi
    {
      git diff --name-only "$base"
      git ls-files --others --exclude-standard
    } | sort -u
  fi
}

is_code() {
  case "$1" in
    src/*|.railway/*|scripts/*|package.json|Caddyfile|vite.config.ts|index.html) return 0 ;;
  esac
  return 1
}

glob_match() {
  local file="$1" pattern="${2//\*\*/*}"
  # shellcheck disable=SC2254
  case "$file" in $pattern) return 0 ;; esac
  return 1
}

unreleased_has_bullet() {
  awk '/^## \[Unreleased\]/{f=1; next} /^## /{f=0} f && /^- /{found=1} END{exit found ? 0 : 1}' CHANGELOG.md
}

CHANGED="$(changed_files)"
if [ -z "$CHANGED" ]; then
  reset_counter
  exit 0
fi

ARCH_GLOBS=()
if [ -f docs/architectural-files.txt ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Trim a trailing CR (CRLF manifests) and surrounding whitespace, then skip blank lines and
    # comments, so the manifest tolerates the same sloppiness a human editor would introduce.
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    [ "${line#\#}" != "$line" ] && continue
    ARCH_GLOBS+=("$line")
  done < docs/architectural-files.txt
fi

CODE_CHANGED=0
OPENAPI_CHANGED=0
CHANGELOG_CHANGED=0
ADR_CHANGED=0
ARCH_CHANGED=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  is_code "$file" && CODE_CHANGED=1
  [ "$file" = "src/api/openapi.json" ] && OPENAPI_CHANGED=1
  [ "$file" = "CHANGELOG.md" ] && CHANGELOG_CHANGED=1
  case "$file" in docs/adr/*.md) ADR_CHANGED=1 ;; esac
  for glob in "${ARCH_GLOBS[@]+"${ARCH_GLOBS[@]}"}"; do
    if glob_match "$file" "$glob"; then
      ARCH_CHANGED="${ARCH_CHANGED:+$ARCH_CHANGED, }$file"
      break
    fi
  done
done <<< "$CHANGED"

if [ "$CODE_CHANGED" = 0 ] && [ -z "$ARCH_CHANGED" ]; then
  reset_counter
  exit 0
fi

FAILED=()

if [ "$CODE_CHANGED" = 1 ]; then
  if [ "$CHANGELOG_CHANGED" = 0 ] || ! unreleased_has_bullet; then
    FAILED+=("Rule A: code changed but CHANGELOG.md has no new bullet under [Unreleased]. Fix: add a bullet under [Unreleased] in CHANGELOG.md")
  fi
fi

if [ "$OPENAPI_CHANGED" = 1 ]; then
  GEN="node_modules/.bin/openapi-typescript"
  if [ ! -x "$GEN" ]; then
    FAILED+=("Rule B: src/api/openapi.json changed but the type generator is not installed. Fix: npm ci, then npm run api:types and commit src/api/types.ts")
  else
    TMP_TYPES="$(mktemp)"
    if "$GEN" src/api/openapi.json -o "$TMP_TYPES" >/dev/null 2>&1 && cmp -s "$TMP_TYPES" src/api/types.ts; then
      :
    else
      FAILED+=("Rule B: src/api/openapi.json changed but src/api/types.ts is not regenerated. Fix: run npm run api:types and commit src/api/types.ts")
    fi
    rm -f "$TMP_TYPES"
  fi
fi

if [ -n "$ARCH_CHANGED" ] && [ "$ADR_CHANGED" = 0 ]; then
  FAILED+=("Rule C: architectural file(s) changed ($ARCH_CHANGED) without an ADR. Fix: add or update an ADR under docs/adr/ (use the write-adr skill)")
fi

if [ ${#FAILED[@]} -eq 0 ]; then
  reset_counter
  echo "docs-check: OK"
  exit 0
fi

print_failures() {
  echo "DOCS CHECK FAILED"
  for f in "${FAILED[@]}"; do
    echo "  - $f"
  done
}

if [ "$MODE" = "--ci" ]; then
  print_failures
  exit 1
fi

mkdir -p .claude
if [ "$STOP_HOOK_ACTIVE" = "false" ]; then
  rm -f "$COUNTER" # a fresh stop, not a continuation of an earlier block: the count starts over
fi
count=0
[ -f "$COUNTER" ] && count="$(cat "$COUNTER")"
count=$((count + 1))
echo "$count" > "$COUNTER"

if [ "$count" -ge "$MAX_BLOCKS" ]; then
  {
    echo "DOCS CHECK FAILED, human intervention required (blocked $count times; no longer blocking the stop)"
    print_failures
  } | tee "$MARKER"
  print_failures >&2
  exit 0
fi

print_failures
print_failures >&2
exit 2
