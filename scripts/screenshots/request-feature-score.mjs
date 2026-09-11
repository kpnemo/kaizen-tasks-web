// The readiness Popover on the interview's "Your request" Card: the three sub-scores as chips
// with the assistant's reason for each, opened from the "Readiness N of 20" button after the
// greeting has been answered (the same state as the `request-feature` scenario).
import { answerGreeting, frameInterview, ready as interviewReady } from "./request-feature.mjs";

export const route = "/request-feature";

export const ready = interviewReady;

export async function act(page) {
  await answerGreeting(page);
  await frameInterview(page);
  await page.getByRole("button", { name: /^Readiness \d+ of 20$/ }).click();
  await page.getByText("How the request scores").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
}
