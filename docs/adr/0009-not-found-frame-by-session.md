# ADR 0009: One catch-all route picks the 404's frame by session

Status: accepted, 2026-09-11

## Context

The 2026-09-11 UI audit found the catch-all route rendering `NotFoundPage` outside both
`RequireAuth` and `AppShell`: a signed-in presenter who mistypes a URL during the demo lands on a
bare page with no header, no nav, no theme control and no footer, and the only way out is an inline
link. The obvious fix, moving `path="*"` inside the `AppShell` route and keeping a second copy
outside for signed-out visitors, does not work: react-router scores the two splat routes equally
and breaks the tie by declaration order, so one copy is dead code and one audience gets the wrong
answer (a signed-out visitor is redirected to log in to a page that does not exist, or a signed-in
user still gets the bare page). `src/app/router.tsx` is an architectural file, so the change that
resolves this is recorded here.

## Decision

`src/app/router.tsx` keeps a single `path="*"` route, outside both guards, whose element is
`NotFoundRoute` (`src/app/routes/NotFoundRoute.tsx`). It reads the session and picks the frame:
while restoring it renders `RestoringScreen`, the way the guards do; for an authenticated user it
renders `AppShell` with `NotFoundPage` as its children; for an anonymous visitor it renders
`NotFoundPage` inside a bare `main` with the `WorkshopFooter`, the frame `PublicOnly` gives the
login and register pages. To make that possible `AppShell` accepts optional `children` and renders
them in place of its `Outlet`. `NotFoundPage` itself is the content only, an `Empty` with a
"Go to your tasks" button, and owns no landmark, so a page never has two `main` elements.

## Consequences

- A mistyped URL while signed in shows the 404 inside the shell, with the nav, the theme control,
  the version footer and a button back to the tasks list; nothing about the demo's path changes.
- An unknown path never redirects to login: a signed-out visitor sees "Page not found" with the
  footer, and "Go to your tasks" takes them through `RequireAuth` to the login page with a
  `returnTo` of `/tasks`.
- `AppShell` now has two entry modes (route layout with `Outlet`, or wrapper with `children`); a
  future change to the shell's frame must keep both rendering the same markup, which the router
  tests cover for the 404 in both sessions.
- `NotFoundRoute` repeats the three lines of `PublicOnly`'s frame rather than importing a shared
  frame component; a third bare-frame screen would be the moment to extract one.
- The product map lists `*` as `NotFoundRoute`; the 404 content still lives in `NotFoundPage`.
