/** Canonical Mint CDN runtime assets. Browser code never calls Mint MCP. */
export const mintModelPaths: Partial<Record<string, string>> = {
  'morrow-sofa': 'https://cdn.mint.gg/glb/morrow-sofa-normalized-51a42fd1d5448882.glb',
  'fold-lounge': 'https://cdn.mint.gg/glb/fold-no-2-lounge-normalized-061a6f20b62177dc.glb',
  'cairn-table': 'https://cdn.mint.gg/glb/cairn-coffee-table-normalized-3fe99785a24a739e.glb',
  'span-table': 'https://cdn.mint.gg/glb/span-dining-table-normalized-161e2b4efd0772b8.glb',
  'pilaster-credenza': 'https://cdn.mint.gg/glb/pilaster-credenza-normalized-7032e4b3dad51d71.glb',
  'loop-daybed': 'https://cdn.mint.gg/glb/loop-daybed-normalized-2ed672e60d5437e7.glb',
}

export const mintDecorModelPaths: Partial<Record<string, string>> = {
  'ultramarine-grid': 'https://cdn.mint.gg/glb/ultramarine-grid-rug-normalized-b42d5ca944185eb6.glb',
  'travertine-tone': 'https://cdn.mint.gg/glb/travertine-tone-rug-normalized-fc5fb77b58f1dc5e.glb',
  'arc-floor-lamp': 'https://cdn.mint.gg/glb/arc-floor-lamp-normalized-099a9dad8ca2ce05.glb',
  'column-table-lamp': 'https://cdn.mint.gg/glb/column-table-lamp-normalized-21811283b442046f.glb',
  'rubber-plant': 'https://cdn.mint.gg/glb/tall-rubber-plant-normalized-88eac1556b52a6b9.glb',
  'olive-planter': 'https://cdn.mint.gg/glb/olive-branch-planter-normalized-498e71ccc7243895.glb',
  'blue-relief': 'https://cdn.mint.gg/glb/ultramarine-relief-art-normalized-3cb0d9a76ae10661.glb',
  'floating-shelf': 'https://cdn.mint.gg/glb/floating-ash-shelf-normalized-356645c72009860e.glb',
}

export const mintCampaignImages: Record<string, string> = {
  'morrow-sofa': 'https://cdn.mint.gg/images/xn76m6wqfv07e0jrm89q2ym7n18ayd7y/morrow-sofa-campaign-cb00d4-738b7228ea486a75.png',
  'fold-lounge': 'https://cdn.mint.gg/images/xn76f7d51ysq2mze5c0cmnx4dh8azcr9/fold-lounge-campaign-e07f7a-7d64e46195ab1d71.png',
  'cairn-table': 'https://cdn.mint.gg/images/xn711yt8kejv11qs7w4a4965t18az7h8/cairn-table-campaign-b3c77d-37a1d0f5301a37c0.png',
  'span-table': 'https://cdn.mint.gg/images/xn76yd3svs72p9ps859hdp8sfd8azgw8/span-table-campaign-4554d5-294ac7fd293374dd.png',
  'pilaster-credenza': 'https://cdn.mint.gg/images/xn7480zz70ptjk9ddnafc71g6h8ayfxm/pilaster-credenza-campaign-f9e663-ee723368d9cc5863.png',
  'loop-daybed': 'https://cdn.mint.gg/images/xn7682h51z32stafxnnyepz1q58ayeg8/loop-daybed-campaign-3fd6aa-73ff7b3a52158954.png',
}

export const mintAudioPaths: Partial<Record<'ambience' | 'placement' | 'material' | 'lighting' | 'drawer' | 'cart', string>> = {
  ambience: 'https://cdn.mint.gg/audio/xd72rdw2exnn8mw6731yv9bkws8ay4gh/quiet-loft-ambience-96bbd5-3c7424c4bed4b54b.mp3',
  placement: 'https://cdn.mint.gg/audio/xd75c8m9sw4g6kb78zwh80vq498aze30/furniture-placement-bd8aa6-9f5d3611b6205cdc.mp3',
  material: 'https://cdn.mint.gg/audio/xd72tw7d39284fggq5xpvyk96s8ayaj8/material-change-b0d17e-96d8708a7b17dc9b.mp3',
  lighting: 'https://cdn.mint.gg/audio/xd7fgdfyk97zn0khcrkg298nwn8azspp/lighting-click-69ef5f-84c7ff81843f8b4b.mp3',
  drawer: 'https://cdn.mint.gg/audio/xd701r3thdgcypq15jhbf1299h8ay9b4/drawer-detail-24920b-e48ca9291035bae3.mp3',
  cart: 'https://cdn.mint.gg/audio/xd70kn5dr577vsp3dqdh9fycwx8azhcx/cart-feedback-647597-a6699f706add8bc6.mp3',
}

export const mintMaterialPaths: Record<string, string> = {
  'natural slub linen': 'https://cdn.mint.gg/materials/w171w8107j1jd6dfn99qf1pp3h8az92s/natural-slub-linen-basecolor-51dbb8-cdfafed3fb82bd82.png',
  'chalk bouclé': 'https://cdn.mint.gg/materials/w17c9zb9nxyexnn8c3adw1csq58aynz7/chalk-boucle-basecolor-ef361b-2f29e7fa41164605.png',
  'chalk boucle': 'https://cdn.mint.gg/materials/w17c9zb9nxyexnn8c3adw1csq58aynz7/chalk-boucle-basecolor-ef361b-2f29e7fa41164605.png',
  'ultramarine wool': 'https://cdn.mint.gg/materials/w17aa03rpdmsn0wq530hvq9z9x8az2wt/ultramarine-wool-basecolor-bcf597-744207a61e40c463.png',
  'cognac saddle leather': 'https://cdn.mint.gg/materials/w17c0czzsq65ewazz98sac5mfs8ay8b2/cognac-saddle-leather-basecolor-85b4d5-140ac4fc20309ced.png',
  'pale ash': 'https://cdn.mint.gg/materials/w17fpm1kzw77tdjc882zwmprtx8azzef/pale-ash-basecolor-d57b52-0e5c8db92deb9a5a.png',
  'smoked oak': 'https://cdn.mint.gg/materials/w172a3dvwkk2sxntqkjr39kk9n8ayj0a/smoked-oak-basecolor-d270e8-b46b867dfa9df6ad.png',
  'warm travertine': 'https://cdn.mint.gg/materials/w17ezn21jxhcdgbzbszj0s7d3d8az68f/warm-travertine-basecolor-624b5d-5f8d51f05349d2a8.png',
  'rosso stone': 'https://cdn.mint.gg/materials/w177bnxqh6yt68j05dp7sxb2n98az3rh/rosso-stone-basecolor-978803-86e878a7badb4733.png',
  'brushed aluminum': 'https://cdn.mint.gg/materials/w17f0vt0vk92gdcsx8sbsxryh98azsvc/brushed-aluminum-basecolor-5faa2a-53b6388c05fbe602.png',
  'polished steel': 'https://cdn.mint.gg/materials/w174j07j6cg3m6ep47d2y2zqyx8ay1se/polished-steel-basecolor-e094b9-b72d5ed30006dfab.png',
  'patinated brass': 'https://cdn.mint.gg/materials/w17eynn1c92cpz6wp51wzhjja58ay26c/patinated-brass-basecolor-edf128-e5d2d16726fc812f.png',
  'bone limewash': 'https://cdn.mint.gg/materials/w17248e6d8e1swz96bz5q4zjth8az63w/bone-limewash-basecolor-53c04f-338c059c34e0f690.png',
  'clay limewash': 'https://cdn.mint.gg/materials/w1737kem475c4ejkfr5czwk5c18ayj9g/clay-limewash-basecolor-1ee87a-c429a2812f8f75bf.png',
  'smoked oak flooring': 'https://cdn.mint.gg/materials/w173mn00k2rpt4m72kv4dq7tb18az219/smoked-oak-flooring-basecolor-ffd0de-196a5813eb2ece3f.png',
}

export const resolveMintMaterialPath = (name: string) => {
  const normalized = name.toLowerCase()
  const exact = mintMaterialPaths[normalized]
  if (exact) return exact
  const key = Object.keys(mintMaterialPaths).find((candidate) => normalized.includes(candidate))
  return key ? mintMaterialPaths[key] : undefined
}
