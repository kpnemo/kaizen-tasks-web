// The live pipeline page scrolled to its middle: the two environment cards (what staging and
// production serve, the checks, the state badge), the snapshot's age line and the top of the
// issues table, as any signed-in user sees them. Same stack as `pipeline`.
import { scrollTo, waitForPipeline } from "./shared/facilitator.mjs";

export const route = "/pipeline";

export async function ready(page) {
  await waitForPipeline(page);
}

export async function act(page) {
  await scrollTo(page, "pipeline-environments");
}
