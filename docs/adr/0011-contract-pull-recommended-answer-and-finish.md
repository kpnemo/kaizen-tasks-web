# ADR 0011: Contract pull for the recommended answer and the finish turn

Status: accepted, 2026-09-12

## Context

Harness issue #31 (spec `docs/superpowers/specs/2026-09-12-context-aware-interview-design.md`,
section 3.5) adds `recommended` to an assistant message that asked a question, `finished` to the
user message that ended an interview, and `finish` to the messages request body. `src/api/**` is an
architectural glob (ADR 0002: the contract is copied, not linked).

## Decision

`src/api/openapi.json` and `src/api/types.ts` are regenerated from kaizen-tasks-api branch
`feat/31-context-aware-feature-request-interview`. The page reads `recommended` to order and badge
the chips and sends `finish: true` from the "Finish with what we have" chip. Nothing else in
`src/api/` changes.

## Consequences

A conversation stored before this release renders as before (`recommended` absent, no badge).
The web pull request merges only after the API pull request, so `develop` carries the same contract.
