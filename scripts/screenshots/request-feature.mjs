// The Request page in interview mode: the "Kaizen assistant" Card (the transcript in its scroll
// area, the option chips, the answer Field, Start over) beside the "Your request" Card (the
// readiness score, the five fields, Review and file). The runner's throwaway user has no open
// conversation, so the page starts one; `act` answers the greeting so the capture shows the state
// the room sees mid-interview: a scored draft and the assistant's option chips. The "Requests so
// far" table under the interview is the `requests-so-far` scenario.
export const route = "/request-feature";

const ANSWER =
  "Supervisors cannot see which tasks a teammate is stuck on before a coaching session.";

export async function ready(page) {
  await page
    .getByRole("heading", { name: "Request a feature", level: 1 })
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("heading", { name: "Kaizen assistant", level: 2 })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("region", { name: "Your request" }).waitFor({ timeout: 15_000 });
  await page.getByRole("textbox", { name: "Your answer" }).waitFor({ timeout: 15_000 });
}

/** Answers the greeting once; the second theme resumes the same conversation, already answered. */
export async function answerGreeting(page) {
  const skip = page.getByRole("button", { name: "Skip this question" });
  if (await skip.isVisible()) return;
  const box = page.getByRole("textbox", { name: "Your answer" });
  await box.fill(ANSWER);
  await page.getByRole("button", { name: "Send" }).click();
  await skip.waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: /^Readiness \d+ of 20$/ }).waitFor({ timeout: 20_000 });
}

/** Frames the two cards the way a presenter does: the chat card's top just under the sticky
 *  header, so the transcript box, the chips, the answer box and the draft are all in the shot. */
export async function frameInterview(page) {
  await page.evaluate(() => {
    document.querySelector("[data-slot=card]")?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -80);
  });
  await page.waitForTimeout(300);
}

export async function act(page) {
  await answerGreeting(page);
  await frameInterview(page);
}
