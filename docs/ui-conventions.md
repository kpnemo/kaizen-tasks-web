# UI conventions

How a control in kaizen-tasks-web looks and behaves. These rules apply to the controls a change
adds or alters. They are not a licence to restyle controls the change does not touch: leave those
alone, even where they predate a rule here.

One exception: a request may name a specific look ("put it in the account menu", "make it a
segmented control"). The request wins, inside the accessibility rules below (accessible name,
keyboard, both themes, projector legibility). Say in the pull request that the look came from the
request.

## shadcn first

Every visible change starts by loading `.claude/skills/shadcn/SKILL.md` (installed from
shadcn/ui with `npx skills add shadcn/ui`; it reads this repo's `components.json`) and the
`frontend-design` skill. The shadcn skill's Critical Rules are this repo's rules too: `className`
for layout, never for overriding a component's colours or type; `flex gap-*`, not `space-y-*`;
semantic tokens, never raw colours or manual `dark:` overrides; `asChild` for custom triggers; icons
inside `Button` carry `data-icon` and no size classes; `Alert` for callouts, `Empty` for empty
states, `Skeleton` for loading, `Badge` for chips, `Separator` for rules. A component the app lacks
is added with `npx shadcn@latest add <name>` and read with `npx shadcn@latest docs <name>`, never
hand-rolled. The 2026-09-11 audit (see the pull requests labelled `ui-rework`) migrates the
hand-written pieces that predate this rule.

## Use the primitives that exist

`src/components/ui/` holds the shadcn primitives this app has: `alert`, `alert-dialog`, `badge`,
`button`, `card`, `checkbox`, `collapsible`, `dropdown-menu`, `empty`, `field`, `input`, `label`,
`popover`, `progress`, `radio-group`, `scroll-area`, `separator`, `skeleton`, `sonner`, `spinner`,
`table`, `textarea`.
Reach for one of these before a native element or a new dependency. Hand-written shared pieces sit
one level up in `src/components/`: `field` (a thin wrapper over the shadcn Field that keeps the hint
beside the error and owns `aria-describedby`), `nav-button` (a `NavLink` in Button clothes, for the
primary nav), `inline-text`, `native-select`, `tag-chip` (with `TagSwatch`, the one place a tag's
colour is painted) and `kaizen-mark`. Add a primitive only when nothing there composes into what the request asks for, and
say so in the pull request.

## Compositions

| What the request asks for               | What to build                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A mode or state switch (2 to 4 choices) | A group of `Button`s, one per choice, each with `aria-pressed` and a lucide icon                                              |
| A short choice list (up to 8)           | A `dropdown-menu`, one icon per item, the current choice named on the trigger                                                 |
| A longer list (more than 8)             | `NativeSelect` (`src/components/native-select.tsx`) with an `aria-label`                                                      |
| A field                                 | `Field` (label, control, hint, error) around an `Input` or `Textarea`                                                         |
| An action that destroys something       | `alert-dialog`, with the verb in the confirm button ("Delete tag"), never a bare `confirm`                                    |
| Feedback after a mutation               | sonner, through `toastApiError` for failures; no inline banner for a transient success                                        |
| Extra detail on demand                  | `popover`, opened by a real button, never hover-only                                                                          |
| A status or a count                     | `badge`, one visible variant per meaning (default, secondary, outline, destructive); never `ghost` for a status               |
| Rows of records with the same fields    | `table` (`Table`, `TableHeader`, `TableRow`, `TableCell`), actions in the last column, no wrapping; never a flex-wrapped list |
| Nothing to show yet                     | `empty` (`Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`), one plain sentence about what to do next                  |
| Waiting for data                        | `skeleton` shaped like the content it replaces, plus `role="status"` text for the screen reader                               |
| Something went wrong on this screen     | `alert` (`variant="destructive"`) with the API error message                                                                  |

Every mode, state or action control carries a lucide-react icon, sized as the header's controls size
theirs: let `Button` size the icon (it applies `size-4`) rather than passing a size, and mark it
`aria-hidden="true"` when the label already names the control.

New header controls match the ones beside them: the same `Button` variants and sizes as
`src/app/layout.tsx` uses today (`variant="outline"` for an action such as "Log out"), the same gap,
and they go in the right-hand group unless the request says otherwise.

## Every screen state exists

A screen that loads data has all four: loading (`role="status"`), empty (one plain sentence saying
what to do next), error (`role="alert"`, the message from the API error envelope), and the content.
Copy them from `TaskListPage` rather than inventing new wording.

## Accessibility and the projector

- Keep the accessible name a user reads out loud: "Log out", "Accept", "Theme". Names listed in
  `README.md`, "Selector contract", are a cross-repo contract with the smoke test; do not change one
  without changing the smoke test.
- Keyboard: every control is reachable by Tab, acts on Enter and Space, and shows the focus ring the
  primitives already give it. A `dropdown-menu` closes on Escape. Never remove `outline` styling.
- The room reads this app on a projector: `text-base` (18px) minimum for anything a user must read,
  44px hit areas, no hover-only control, and no colour as the only signal.
- Check the screen at 125% browser zoom, which is what `scripts/screenshot.mjs` captures.
- Check both themes. The `dark` class on `<html>` is the only switch (ADR 0006); use the theme
  tokens (`bg-card`, `text-muted-foreground`, `border-input`) rather than fixed colours, and if a
  colour has no token, give it a `dark:` variant.

## Show the change

A pull request that changes anything visible carries a screenshot of the changed screen in both
themes: `node scripts/screenshot.mjs <scenario>` writes `docs/screenshots/<scenario>-{light,dark}.png`.
The `add-frontend-feature` skill has the exact steps and the pull request template.
