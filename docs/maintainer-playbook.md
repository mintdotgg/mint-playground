# GitHub visibility playbook

This checklist keeps Mint Playground discoverable without turning the README or
release feed into marketing noise.

## Repository settings

These settings live in GitHub and cannot be applied by a pull request.

**Description**

> 39 open-source Three.js and React Three Fiber apps, games, configurators, visualizations, and Gaussian-splat worlds—with live demos and source code.

**Website**

`https://play.mint.gg`

**Topics**

`threejs`, `webgl`, `react-three-fiber`, `typescript`, `3d`, `creative-coding`,
`browser-games`, `game-development`, `interactive-3d`, `gaussian-splatting`,
`model-context-protocol`, `3d-visualization`

Upload [`.github/assets/social-preview.jpg`](../.github/assets/social-preview.jpg)
as the repository social preview. GitHub Settings → General → Social preview is
the current location of that control.

Enable Discussions only when a maintainer can respond consistently. Start with
Announcements, Q&A, Ideas, and Show and tell.

## Publishing an experience

1. Confirm the experience has an `experience.json`, package metadata, README,
   live demo, source link, and a local social card at
   `.github/assets/experiences/<slug>.webp`.
2. Confirm all names, models, images, audio, and reference material can be
   published. Rename or remove material with unclear rights before promotion.
3. Run `pnpm validate:catalog` and the experience's build and tests.
4. Add it to the category and full catalog sections in the root README, and use
   the local social card from both the root and experience READMEs.
5. Use the `new-experience` label so generated release notes classify it.

## Playground drops

Publish a GitHub release after a meaningful group of additions rather than for
every commit. A good release includes:

- One strong visual and a one-sentence theme.
- Direct links to each live demo and source directory.
- The reusable Three.js patterns demonstrated by the new work.
- Credit for external contributors.
- A short prompt to watch releases for future drops.

## Weekly measurement

GitHub Insights → Traffic retains a rolling 14-day window. Record these metrics
weekly so results can be compared across equivalent periods:

- Unique visitors and total views.
- Unique cloners and total clones.
- Referring sites and popular repository pages.
- Net-new stars, watchers, forks, and external contributors.
- Issues and discussions that received a maintainer response.

Use visitor growth and useful participation as the primary signals. Stars are a
helpful secondary signal, not a substitute for people successfully running and
learning from the projects.
