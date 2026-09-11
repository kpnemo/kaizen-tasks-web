// The passphrase dialog behind "Deploy 1.5.0 to production": the title, what will ship, the
// password field with the passphrase typed so the verb button is live, Cancel and the verb.
// Same fixture and facilitator sign-in as pipeline-facilitator (PIPELINE_LIVE=1 for live rows).
import { signInAsFacilitator, waitForPipeline } from "./shared/facilitator.mjs";

export const route = "/pipeline";

export async function ready(page) {
  await waitForPipeline(page);
}

export async function act(page) {
  await signInAsFacilitator(page);
  await page
    .getByRole("button", { name: /^Deploy .* to production$/ })
    .first()
    .click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByLabel("Deploy passphrase").fill("workshop-demo-passphrase");
  await page.waitForTimeout(300);
}
