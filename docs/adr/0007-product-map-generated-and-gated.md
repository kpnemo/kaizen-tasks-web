# ADR 0007: The product map is generated from this checkout and compared on every docs check

Status: accepted, 2026-09-10

## Context

The harness interviews a product owner before it implements a request, and its questions are only
as good as what it knows about the app. Hand-written summaries of "what this app is and what it
has" rot within a release, and a rotten map is worse than none: it makes an agent confident and
wrong. The alternatives were a map written by hand and reviewed at each release (rots between
reviews), a map assembled live by an exploration subagent (slow, and different every run), or a
generated map kept honest by the docs gate. The gate already blocks a change whose docs are stale
(Rules A to C), so it is the one place that can make staleness impossible.

## Decision

`docs/product-map.md` has two parts. Above the marker `<!-- product-map:generated -->` is prose
written and reviewed by a person, ending with a `Reviewed:` line naming the PRD sections it was
read against. Everything below it is replaced wholesale by `scripts/product-map.mjs`
(`npm run product-map`), which reads `src/app/router.tsx` and `src/app/layout.tsx` with the
TypeScript compiler API, plus `src/features/*/`, `src/api/openapi.json`, `CHANGELOG.md` and
`docs/adr/*.md`. A construct the scanner cannot read exits 1 with the file and line rather than
dropping content silently. The output is sorted, carries no timestamps and no absolute paths, and
is formatted with the repo's Prettier, so regenerating an unchanged tree is byte-identical.

Docs-check Rule D regenerates the map into a temp file and compares it with the committed one on
every invocation, in both `--hook` and `--ci` mode, before and independent of the "no code or
architectural changes" early return. A missing map, a generator failure, or any difference fails
the check. There is no list of trigger paths.

## Consequences

- A stale map cannot merge, and no one has to remember which files feed it.
- Every change to a map source also changes `docs/product-map.md`, so diffs carry that file and the
  skills gained a `npm run product-map` step before the checks and the commit.
- Rule D spends a Node process and one Prettier pass (about a second) on every docs check, hook runs
  included. That is the price of having no trigger list to keep in step with the generator.
- A router or layout written in a shape the scanner does not understand blocks the gate until the
  generator learns it. That is deliberate: the alternative is a map that quietly omits a screen.
- The map must stay small enough to sit in an interview's context: a test holds it under 12 KB and
  250 lines, so growth means cutting what the map keeps, not raising the budget. Every part fed by
  the changelog is therefore bounded: released bullets are the newest three releases, two bullets
  each, cut at 120 characters, and `[Unreleased]` is cut at 200 characters a bullet and 1,600 for
  the section, with a line counting what did not fit. A busy release cycle cannot push the map over
  its budget and fail an unrelated feature's test run.
- `docs/ui-conventions.md` is pointed at from the header, not copied into the map, so the design
  rules have one home.
