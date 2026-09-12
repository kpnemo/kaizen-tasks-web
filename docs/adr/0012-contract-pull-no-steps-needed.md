# ADR 0012: Contract pull for the sized breakdown and the no_steps_needed skip reason

Status: accepted, 2026-09-12

## Context

Harness issue #34 sizes the assistant's automatic breakdown to the task instead of a fixed three to
seven steps: kaizen-tasks-api ADR 0008 adds the skip reason `no_steps_needed` for a task the
assistant judges already small enough to do as is, and the breakdown may now return anywhere from
zero to fifty suggested steps. `src/api/**` is an architectural glob (ADR 0002: the contract is
copied, not linked).

## Decision

`src/api/openapi.json` and `src/api/types.ts` are pulled from kaizen-tasks-api branch
`feat/34-size-the-automatic-breakdown-to-the-task`. The only web change is the label
`Small enough to do as is` added to `SKIP_LABELS` in `src/lib/format.ts` for the new
`no_steps_needed` reason; the step list is not capped anywhere in the page.

## Consequences

`SKIP_LABELS` is typed `Record<AiSkipReason, string>`, so the build fails until the label exists,
which is the change this pull request makes. A task with many suggested steps renders as a long
list, uncapped, same as before; nothing about the client's rendering or pagination has to change to
support it. The web pull request merges only after the API pull request, so `develop` carries the
same contract.
