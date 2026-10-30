# Asset and dependency notice

Every runtime file loads from Mint CDN and is registered in `mint-assets.json`.
No model or texture binaries are committed to this package.

## 3D models

- `mint-iss`: Mint Modeler International Space Station, source asset
  `ks7404tzgtbcwxcgs7g4rtper98h7r30`. The runtime file is a glTF-Transform Draco
  copy of that asset's original GLB. Node names, transforms, materials, and
  primitive counts match the original artifact exactly; only mesh compression
  differs (21.3 MB instead of 58.7 MB).
- `tripo-iss`: Tripo H3.1 image-to-3D comparison output.
- `meshy-iss`: Meshy 7.1 image-to-3D comparison output.
- `rodin-iss`: Hyper3D Rodin 2.5 image-to-3D comparison output.

The three comparison outputs were generated outside Mint, so their registry
entries use `kind: "external"` with content-hash identifiers instead of Mint
asset IDs.

## Earth textures

The Earth albedo, normal, specular, and cloud maps come from the Three.js
example texture set.

## Runtime dependencies

- Three.js `0.184.0` from the workspace, with the shared Mint CDN Draco decoder.
- IBM Plex Mono and Inter through Google Fonts.
