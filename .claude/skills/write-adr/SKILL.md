---
name: write-adr
description: Use when a change touches an architectural file (docs/architectural-files.txt) or reverses an earlier decision in kaizen-tasks-web. Produces a numbered ADR in docs/adr with context, decision, consequences, and status.
---

# Write an ADR

Architecture decision records live in `docs/adr/` and are required by docs-check Rule C whenever a
file matching `docs/architectural-files.txt` changes (`src/api/**`, `Caddyfile`, `.railway/**`,
`src/app/router.tsx`, `src/main.tsx`).

## Numbering

`NNNN-short-kebab-title.md`, four digits, next number after the highest existing one
(`ls docs/adr | tail -n 1`). Never renumber. A decision that replaces an older one gets a new number
and the old ADR's status line becomes `Status: superseded by ADR NNNN`.

## Template

```markdown
# ADR NNNN: <decision in one line>

Status: accepted, <YYYY-MM-DD>

## Context

What forces are at play: the requirement, the constraint, the alternatives that were on the table.
Two to five sentences. Name the spec section or PRD requirement when there is one.

## Decision

What we do, in the present tense, concrete enough that a reviewer can check the code against it.

## Consequences

What becomes easier, what becomes harder, what must now be true elsewhere (another repo, a Railway
variable, a test). Bullets. Include the fallback if the decision rests on an open verification item.
```

## Checklist

- Title states the decision, not the topic ("Access token lives in memory", not "Token storage").
- Context does not restate the decision.
- Consequences include at least one cost.
- Link the ADR from `docs/ARCHITECTURE.md` when it changes the diagram or a flow described there.
- Add a `CHANGELOG.md` bullet under `[Unreleased]` for the change that motivated it.
