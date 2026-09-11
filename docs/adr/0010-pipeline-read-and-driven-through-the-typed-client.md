# ADR 0010: The pipeline page reads and drives the pipeline only through the typed client

Status: accepted, 2026-09-11

## Context

The pipeline control room (spec `docs/superpowers/specs/2026-09-11-pipeline-control-room-design.md`
in the harness repo, "The page: /pipeline") puts one screen in the app that shows where every issue
stands and carries the two facilitator clicks, "Deploy to staging" and "Deploy to production". The
data comes from GitHub and from the two Railway environments, and the clicks merge pull requests
and dispatch a workflow with tokens that must never reach a browser. The API (kaizen-tasks-api #21)
owns all of that behind four routes under `/api/v1/pipeline`, mounted only when its five settings
are present and announced by `features.pipeline` in `GET /health`. The same contract change made
`ErrorEnvelope.details` a three-way union (`ValidationDetail[]`, `RateLimitDetails`, the new
`ForbiddenDetails { reason: "passphrase" }`), because a wrong passphrase must be told apart from
"not a facilitator" without leaking which it was to anyone but the caller.

## Decision

This repo pulls the contract (`scripts/pull-openapi.sh --local ../backend/openapi.json`, then
`npm run api:types`) and touches the pipeline only through `client` in `src/api/client.ts`:
`GET /pipeline`, `POST /pipeline/issues/{number}/deploy-staging`, `POST /pipeline/ship` and
`POST /pipeline/ship/retry`, with their bodies and responses aliased from `paths` in
`src/api/models.ts` (`PipelineSnapshot`, `PipelineIssue`, `PipelinePullRequest`,
`PipelineEnvironment`, `DeployBody`, `ShipBody`, `ShipRetryBody`). The web derives nothing the API
already decided: stages, readiness, `onStaging`, `productionReady`, `nextVersion` and `canDeploy`
are rendered as received. `src/features/pipeline/hooks.ts` holds one query (key `["pipeline"]`,
`refetchInterval: 10_000`, never in the background) and three mutations that invalidate that key
on success and hand their `ApiError` back to the dialog rather than toasting it, except a network
failure, which is toasted like everywhere else. `ApiError` gains `forbiddenReason()`, which narrows
the `details` union with an `in` check, so the dialog's "Wrong passphrase" field error rests on the
documented shape and not on a string compare of the message. The route `/pipeline` and the header
link "Pipeline" exist only while health reports `features.pipeline: true`, the pattern
`FeatureRequestLink` set.

## Consequences

- `src/api/openapi.json`, `src/api/types.ts`, `src/api/models.ts` and `src/api/errors.ts` change
  with the contract; `src/app/router.tsx` and `src/app/layout.tsx` gain the route and the link. All
  six are architectural files (docs-check Rule C), which is why this ADR exists.
- `Health.features.pipeline` is required in the generated type, so every test health body carries
  it (`tests/msw/handlers.ts`, `healthBody`), and an API older than #21 makes the footer's health
  read fail the type of `features`, not the runtime: the flag reads `false` and the page hides.
- One request every ten seconds per open `/pipeline` tab, answered from the API's 30-second
  snapshot cache; the page never talks to GitHub, Railway or the other environment.
- The passphrase lives in the dialog's state for the length of one request and is never stored,
  logged or echoed; the browser learns `canDeploy` and nothing about credentials.
- The facilitator must set five Railway variables on the `api` service (`PIPELINE_GITHUB_TOKEN`,
  `FACILITATOR_EMAILS`, `DEPLOY_PASSPHRASE`, `STAGING_WEB_URL`, `PRODUCTION_WEB_URL`) before the
  link appears in an environment; until then the page is invisible rather than broken.
