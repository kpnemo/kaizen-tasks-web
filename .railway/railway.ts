import { defineRailway, github, project, service } from "railway/iac";

/**
 * Named partial: this file owns ONLY the `web` service. Railway IaC treats "omitted" as "delete"
 * inside the set of resources a file owns; exporting `partial` scopes that set to `web`, so
 * applying this file can never destroy `api`, `Postgres`, or `Redis`, which the API repo's own
 * `.railway/railway.ts` declares. This is the mechanism Railway documents for split repositories
 * ("One file per project", docs.railway.com/infrastructure-as-code). Never rename it once applied.
 */
export const partial = "web";

/**
 * The web service of project kaizen-tasks. Applied per environment by the CI/CD lane with
 * `railway config apply`; the branch follows the environment (develop -> staging, main -> production).
 * No `start`: Railpack serves dist/ through the root Caddyfile (see docs/ARCHITECTURE.md).
 * PORT is pinned to 8080 so the public domain's target port is deterministic (master plan interface
 * "Web port"); the Caddyfile binds :{$PORT}. The API service pins PORT=3000 in its own file.
 * Wait-for-CI is the source field `checkSuites` (master plan section 5); it is already on for `web`
 * in both environments, and declaring it keeps a future apply from switching it off.
 */
export default defineRailway((ctx) => {
  const branch = ctx.isEnvironment("production") ? "main" : "develop";

  const web = service("web", {
    source: github("kpnemo/kaizen-tasks-web", { branch, checkSuites: true }),
    build: "npm run build",
    healthcheck: "/version.json",
    healthcheckTimeout: 120,
    env: { PORT: "8080" },
  });

  return project("kaizen-tasks", { resources: [web] });
});
