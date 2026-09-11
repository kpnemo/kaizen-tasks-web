// A GET /pipeline answer with one row at every stage, for the two facilitator captures.
//
// The live harness repository rarely has a row in flight at capture time (on 2026-09-11 it held
// four triaged and three shipped issues), and the buttons, the ship badges and the dialog only
// exist for rows in flight. So `pipeline-facilitator` and `pipeline-dialog` answer the page's
// GET /pipeline from this fixture (Playwright `page.route`) unless PIPELINE_LIVE=1. Everything
// else in those captures is live: the session, the health flag, the shell. The environments,
// branch heads, issue numbers, titles and shipped rows below are copied from the live snapshot of
// that day; the pull requests on #5, #4 and #3 are the fixture's own.
export const PIPELINE_ROUTE = "**/api/v1/pipeline";

const SHA = {
  apiDevelop: "0901ba99cb13b86d2ba1b5b9b549944344ad44c8",
  apiMain: "06ab2154274e7ffb0f0fbb80750566982c8f51b9",
  webDevelop: "79539d18b03304f0e140659552a66edf8fc9dd83",
  webMain: "505ad6a25fd1a9f3fbdb99001ee3aab1880efae4",
};

const HARNESS = "https://github.com/kpnemo/kaizen-tasks-assembly-line";

function pull(repo, number, state, checks = null) {
  const name = repo === "harness" ? "kaizen-tasks-assembly-line" : `kaizen-tasks-${repo}`;
  return {
    repo,
    number,
    url: `https://github.com/kpnemo/${name}/pull/${number}`,
    state,
    checks: state === "open" ? checks : null,
    mergeSha: state === "merged" ? `${repo}${number}`.padEnd(40, "0") : null,
    headSha: `head${repo}${number}`.padEnd(40, "0"),
    draft: false,
  };
}

function issue(number, title, stage, readiness, labels, over = {}) {
  const shipped = stage === "shipped";
  return {
    number,
    title,
    kind: "feature-request",
    state: shipped ? "closed" : "open",
    stage,
    readiness,
    url: `${HARNESS}/issues/${number}`,
    labels: ["feature-request", ...labels, stage === "implementing" ? "implementing" : stage],
    createdAt: "2026-09-09T13:09:53Z",
    closedAt: shipped ? "2026-09-11T10:10:09Z" : null,
    pullRequests: [],
    onStaging: stage === "staging" || shipped,
    productionReady: stage === "staging",
    ship: null,
    ...over,
  };
}

/** The snapshot as the API would envelope it, dated now so "as of" reads as live. */
export function pipelineSnapshotBody() {
  return {
    data: {
      generatedAt: new Date().toISOString(),
      stale: false,
      canDeploy: true,
      nextVersion: "1.5.0",
      ship: { active: false, run: null },
      environments: {
        staging: {
          api: { version: "1.4.0", commit: SHA.apiDevelop, db: "ok", redis: "ok" },
          web: { version: "1.4.0", commit: SHA.webDevelop },
          state: "current",
        },
        production: {
          api: { version: "1.4.0", commit: SHA.apiMain, db: "ok", redis: "ok" },
          web: { version: "1.4.0", commit: SHA.webMain },
          state: "current",
        },
      },
      branches: {
        api: { develop: SHA.apiDevelop, main: SHA.apiMain },
        web: { develop: SHA.webDevelop, main: SHA.webMain },
      },
      issues: [
        issue(
          5,
          "Regenerate suggestions with a hint",
          "implementing",
          16,
          ["clarity:5", "complexity:3", "risk:3"],
          {
            pullRequests: [pull("api", 27, "open", "green"), pull("web", 29, "open", "green")],
          },
        ),
        issue(
          4,
          "Share a task with a teammate",
          "staging",
          12,
          ["clarity:5", "complexity:5", "risk:5"],
          {
            pullRequests: [
              pull("api", 26, "merged"),
              pull("web", 28, "merged"),
              pull("harness", 31, "merged"),
            ],
          },
        ),
        issue(
          3,
          "Make the AI smarter",
          "implementing",
          11,
          ["clarity:2", "complexity:2", "risk:3"],
          {
            pullRequests: [pull("web", 30, "open", "pending")],
          },
        ),
        issue(2, 'Add a "Mark all steps done" button on the task detail', "triaged", 17, [
          "clarity:5",
          "complexity:2",
          "risk:3",
        ]),
        issue(
          22,
          "Show existing requests at the bottom of the Request a feature page",
          "shipped",
          17,
          ["clarity:5", "complexity:3", "risk:2"],
          {
            pullRequests: [
              pull("api", 18, "merged"),
              pull("web", 19, "merged"),
              pull("harness", 23, "merged"),
            ],
          },
        ),
        issue(
          19,
          "Change app accent color from blue to dark brown/reddish",
          "shipped",
          17,
          ["clarity:4", "complexity:2", "risk:1"],
          {
            pullRequests: [pull("web", 15, "merged"), pull("harness", 20, "merged")],
          },
        ),
      ],
    },
    meta: { requestId: "screenshot-fixture" },
  };
}

/** Answers the page's GET /pipeline from the fixture until the page is closed. */
export async function serveFixture(page) {
  await page.route(PIPELINE_ROUTE, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: pipelineSnapshotBody() })
      : route.continue(),
  );
}
