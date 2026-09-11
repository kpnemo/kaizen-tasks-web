// The pipeline page as any signed-in user sees it, live: the flow diagram, what staging and
// production serve, the snapshot's age and the issues table without buttons (the runner's
// throwaway user is not a facilitator). The dev API needs the five pipeline settings and, on a
// machine behind a TLS proxy, NODE_OPTIONS=--use-system-ca so it can read the two environments.
import { waitForPipeline } from "./shared/facilitator.mjs";

export const route = "/pipeline";

export async function ready(page) {
  await waitForPipeline(page);
}
