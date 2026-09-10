---
name: release-notes
description: Use when cutting a version of kaizen-tasks-web. Moves the CHANGELOG [Unreleased] section into a dated version section, bumps package.json, and leaves a fresh empty [Unreleased].
---

# Release notes

1. Read `CHANGELOG.md`. Everything under `## [Unreleased]` ships in this version. If it is empty,
   stop: there is nothing to release.
2. Choose the version with semver from the bullets: a `### Removed` or breaking `### Changed`
   bullet bumps minor while we are pre-1.0, otherwise bump patch. Confirm with the user when unsure.
3. Edit `CHANGELOG.md`:
   - Insert `## [<version>] - <YYYY-MM-DD>` directly below `## [Unreleased]`, moving every
     subsection (`### Added`, `### Changed`, `### Fixed`, `### Removed`) under it.
   - Leave `## [Unreleased]` in place with no bullets.
   - Keep the sections in Keep a Changelog order and the bullets in the order they were added.
4. Bump `"version"` in `package.json` to the same value and run `npm install --package-lock-only`
   so `package-lock.json` follows.
5. Run `npm run product-map` and stage `docs/product-map.md`: the map keeps the newest three
   releases, so moving the `[Unreleased]` bullets under a version heading changes it, and
   docs-check Rule D compares it on every run.
6. Run `npm run lint && npm test`.
7. Commit as `chore: release <version>` with the repo's commit trailer (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`), on `develop`. The
   promotion to `main` happens by pull request after staging verification, never by a direct push.
8. Reply with the version, the date, and the list of bullets that shipped.
