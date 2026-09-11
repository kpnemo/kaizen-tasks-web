// The pipeline page as the facilitator sees it: "Deploy to staging" on an implementing row whose
// pull requests are green, "Deploy 1.5.0 to production" on a staging row, hints on the rest.
// The issues come from scripts/screenshots/shared/pipeline-snapshot.mjs unless PIPELINE_LIVE=1
// (see that file for why); the session, the health flag and the shell are live.
import { scrollTo, signInAsFacilitator, waitForPipeline } from "./shared/facilitator.mjs";

export const route = "/pipeline";

export async function ready(page) {
  await waitForPipeline(page);
}

export async function act(page) {
  await signInAsFacilitator(page);
  await scrollTo(page, "pipeline-issues");
}
