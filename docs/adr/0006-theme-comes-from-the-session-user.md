# ADR 0006: The theme comes from the session user, and the `dark` class is the only switch

Status: accepted, 2026-09-10

## Context

Assembly-line issue #11 asks for a Light / Dark / System control whose choice survives signing in on
another device. The web could have kept the choice in `localStorage` and treated the account copy as
a mirror, or read it from the account only. A local copy is the usual trick against a first-paint
flash, but it makes two sources of truth for one value and would have to be reconciled on every
sign-in — and this app already has no client-side session storage at all (ADR 0003: the access token
lives in memory). Separately, Tailwind 4's `dark:` variant defaults to `prefers-color-scheme`, which
cannot express "the user asked for light while the OS is dark", so the variant had to be redefined
before any of the three choices could work.

## Decision

The preference is read from `authStore`'s session user (`user.theme`, new in the contract this
change pulls) and from nowhere else; there is no browser copy. `src/features/theme/` owns the whole
feature: `theme.ts` resolves a preference plus the OS setting into `light` or `dark` and is the only
code that touches the DOM for it, `hooks.ts` applies it and saves it, `ThemeToggle.tsx` is the
control the header renders. `useApplyTheme()` is mounted once, in `AppRoutes`, so every screen —
signed in or not — is themed by one effect; while the preference is `system` that effect also
subscribes to the `(prefers-color-scheme: dark)` media query, so a change to the OS setting is
followed live. Saving is optimistic: the choice goes onto the session user first, so the page turns
at once, then `PATCH /auth/me` persists it and a failure puts the previous value back and raises the
standard error toast. `globals.css` declares `@custom-variant dark (&:is(.dark *))` and a `.dark`
token block, so `dark:` and every `--color-*` token follow the class this feature sets on `<html>`,
never the media query directly.

## Consequences

- One source of truth: what the API returns on the user is what the page shows, and no reconciliation
  code is needed on sign-in, sign-out, or token refresh.
- The first paint in light for a signed-in dark user while `AuthProvider` restores the session was
  real: `RestoringScreen` covered the window before a token existed, but `AuthProvider` renders
  `AppRoutes` again as soon as `authStore.setToken` flips the status to `authenticated`, which is
  before `GET /auth/me` returns the account's `user.theme`, so `useThemePreference` had nothing but
  `DEFAULT_THEME` ("system") to fall back on. A `localStorage` cache (`kaizen.theme`, per device, not
  the account, so ADR 0003's in-memory rule for the access token does not apply) is now that fix: an
  inline script in `index.html`'s `<head>`, before the stylesheet, reads it and sets the `dark` class
  before first paint; `theme.ts`'s `applyTheme` writes the key every time it applies a theme; and
  `useThemePreference` reads it as the fallback while there is no session user yet, so the page shows
  this device's last theme instead of always `system` during that window. The session user's
  preference still wins the moment it loads, and only replaces the cache when it actually differs.
- A signed-out visitor now shows this device's last applied theme (the cache), not always `system`,
  unless nothing has ever been applied here — `login` and `register` follow the same cache.
- Every `dark:` utility already in the shadcn primitives now means "the user chose dark". They were
  previously wired to the OS setting and effectively unreachable, because no dark tokens existed.
- The API must ship first: the web's typed client cannot call `PATCH /auth/me` until the contract in
  `src/api/openapi.json` carries it (ADR 0002, the contract is copied, not linked).
