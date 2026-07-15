# Mint Playground

Open-source Three.js Experiences from [Mint Playground](https://play.mint.gg/).

Every app here was made with [Mint MCP](https://mcp.mint.gg/) as the 3D asset
pipeline and
[Mint Three.js Skills](https://github.com/mintdotgg/mint-threejs-skills) as the coding workflow.

## Experiences

<table>
<tr>
<td width="50%" valign="top">
  <a href="https://play.mint.gg/vanguard-protocol"><img src="https://play.mint.gg/experience-assets/vanguard-protocol/social-card.webp" alt="Nyx-7 displayed in the Vanguard Protocol combat roster" width="100%"></a>
  <h3>Vanguard Protocol</h3>
  <p>A cinematic five-character combat roster with animated fighters and reactive tactical staging.</p>
  <p><sub>Three.js · Characters · Animation · Interactive</sub></p>
  <p><a href="https://github.com/mintdotgg/mint-playground/tree/main/experiences/vanguard-protocol">Code</a> · <a href="https://play.mint.gg/vanguard-protocol">Live demo</a></p>
</td>
<td width="50%" valign="top">
  <a href="https://play.mint.gg/helios-form"><img src="https://play.mint.gg/experience-assets/helios-form/social-card.webp" alt="Asterion interceptor displayed in the Helios Form orbital showroom" width="100%"></a>
  <h3>Helios Form</h3>
  <p>A luminous orbital-vehicle showroom for inspecting six futuristic craft and their onboard systems.</p>
  <p><sub>Three.js · Vehicles · Showroom · Audio</sub></p>
  <p><a href="https://github.com/mintdotgg/mint-playground/tree/main/experiences/helios-form">Code</a> · <a href="https://play.mint.gg/helios-form">Live demo</a></p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
  <a href="https://play.mint.gg/neon-relic"><img src="https://play.mint.gg/experience-assets/neon-relic/social-card.webp" alt="Aether humanoid displayed in the Neon Relic editorial gallery" width="100%"></a>
  <h3>Neon Relic</h3>
  <p>An interactive poster gallery where four sci-fi relics reshape the typography, lighting, materials, and sound.</p>
  <p><sub>Three.js · Editorial · Models · Audio</sub></p>
  <p><a href="https://github.com/mintdotgg/mint-playground/tree/main/experiences/neon-relic">Code</a> · <a href="https://play.mint.gg/neon-relic">Live demo</a></p>
</td>
<td width="50%" valign="top">
  <a href="https://play.mint.gg/impossible-places"><img src="https://play.mint.gg/experience-assets/impossible-places/social-card.webp" alt="The Observatory issue of the Impossible Places travel magazine" width="100%"></a>
  <h3>Impossible Places</h3>
  <p>A cinematic travel magazine spanning five explorable Mint-generated Gaussian-splat worlds.</p>
  <p><sub>Three.js · Gaussian Splats · Worlds · Exploration</sub></p>
  <p><a href="https://github.com/mintdotgg/mint-playground/tree/main/experiences/impossible-places">Code</a> · <a href="https://play.mint.gg/impossible-places">Live demo</a></p>
</td>
</tr>
</table>

## Run locally

Install the workspace and start any Experience by its directory name:

```bash
pnpm install
pnpm --dir experiences/vanguard-protocol dev
```

Build every Experience with `pnpm build`.

## License

The source code is available under the [MIT License](./LICENSE). Mint-generated
runtime assets are loaded from Mint CDN and are not redistributed in this
repository.
