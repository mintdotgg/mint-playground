# Contributing to Mint Playground

Thanks for helping make these open-source 3D experiences easier to learn from,
run, and reuse.

## Good contributions

The most useful contributions are focused and easy to review:

- Fix a reproducible bug in one experience.
- Improve keyboard, touch, screen-reader, or reduced-motion support.
- Improve runtime performance or asset-loading behavior with measurements.
- Add tests for an existing system.
- Clarify setup instructions or explain a reusable Three.js pattern.
- Report a broken demo, source link, or catalog entry.

New experiences are generally published through Mint's release pipeline. Before
building one for this repository, open an experience request so the maintainers
can confirm its scope and publication path.

## Before you start

Search existing issues and pull requests first. For a substantial change, open
an issue describing the user problem and proposed approach before investing in
implementation. Issues labeled [`good first issue`](https://github.com/mintdotgg/mint-playground/labels/good%20first%20issue)
are intentionally small and should include enough context to begin.

Only contribute code and media you have permission to publish. Do not commit
credentials, production data, runtime assets downloaded from Mint CDN, or
third-party media without a compatible license and attribution. The curated
social cards under `.github/assets/experiences` are the intentional exception.

## Local setup

This repository uses Node.js 20 or newer and the pnpm version pinned in
`package.json`.

```bash
corepack enable
pnpm install --filter ./experiences/vanguard-protocol
pnpm play vanguard-protocol
```

Replace `vanguard-protocol` with any slug printed by `pnpm play --list`.

## Validate your change

Always validate the catalog and build the experience you changed:

```bash
pnpm validate:catalog
pnpm --filter ./experiences/vanguard-protocol build
```

Run experience-specific tests when its `package.json` defines a `test` script.
Use `pnpm build` only when you need to verify the entire workspace.

## Pull requests

- Keep a pull request focused on one experience or one repository-wide concern.
- Explain the user-visible result and how you verified it.
- Include before-and-after captures for visual changes.
- Preserve each experience's existing framework and style unless the issue
  explicitly calls for a migration.
- Update `experience.json` and the root catalog when metadata or URLs change.
- Do not reformat unrelated files.

By contributing, you agree that your contribution will be licensed under the
repository's [MIT License](LICENSE).
