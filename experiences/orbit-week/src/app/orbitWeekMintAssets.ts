export const ORBIT_WEEK_MINT_ASSETS = {
  background:
    "https://cdn.mint.gg/images/xn79pd38zsyxzcm24a4sqs4pe98atbr1/orbit-week-deep-space-d44948-2f28b6d70d5b2089.png",
  sun: "https://cdn.mint.gg/glb/photoreal-smooth-sun-normalized-4924b967f1ace14a.glb",
  saturnRings:
    "https://cdn.mint.gg/glb/saturn-broad-ring-system-normalized-965917a97de82dea.glb",
  planets: {
    mercury:
      "https://cdn.mint.gg/glb/realistic-mercury-normalized-89cfc45bed88314a.glb",
    venus:
      "https://cdn.mint.gg/glb/photoreal-smooth-venus-normalized-f931f705beefd5ed.glb",
    earth:
      "https://cdn.mint.gg/glb/photoreal-smooth-earth-normalized-c8ce8fc16d15eed5.glb",
    mars: "https://cdn.mint.gg/glb/realistic-mars-normalized-0ed719c3bf6d9b08.glb",
    jupiter:
      "https://cdn.mint.gg/glb/photoreal-smooth-jupiter-normalized-2b43e1963b6e80d6.glb",
    saturn:
      "https://cdn.mint.gg/glb/saturn-atmospheric-body-normalized-d8431de09dede68c.glb",
    neptune:
      "https://cdn.mint.gg/glb/photoreal-smooth-neptune-normalized-a51b555dd630632b.glb",
  },
  materials: {
    venus: {
      baseColor:
        "https://cdn.mint.gg/materials/w17a72dv838mxtecx133q7j2hn8azznb/orbit-week-v6-realistic-venus-atmosphere-basecolor-f3cdf8-e1b552433d469f95.png",
      normal:
        "https://cdn.mint.gg/materials/w17a72dv838mxtecx133q7j2hn8azznb/orbit-week-v6-realistic-venus-atmosphere-normal-1651ee-dce3aa1ad050a8c3.png",
      roughness:
        "https://cdn.mint.gg/materials/w17a72dv838mxtecx133q7j2hn8azznb/orbit-week-v6-realistic-venus-atmosphere-roughness-59f5e7-b55bb704c5c65161.png",
    },
    sun: {
      baseColor:
        "https://cdn.mint.gg/materials/w17etkrepj2xn28j8xym1d5cfx8ay200/orbit-week-v6-natural-boiling-solar-surface-basecolor-d81e84-188fcb6bba997828.png",
      normal:
        "https://cdn.mint.gg/materials/w17etkrepj2xn28j8xym1d5cfx8ay200/orbit-week-v6-natural-boiling-solar-surface-normal-539e87-627202659f8d9cf3.png",
      roughness:
        "https://cdn.mint.gg/materials/w17etkrepj2xn28j8xym1d5cfx8ay200/orbit-week-v6-natural-boiling-solar-surface-roughness-c994aa-c5283b3f1c81dd01.png",
    },
    jupiter: {
      baseColor:
        "https://cdn.mint.gg/materials/w1738wtyw0asanfq7zj2webc7d8awe77/jupiter-turbulent-atmosphere-basecolor-af0964-718dace93382b788.png",
      normal:
        "https://cdn.mint.gg/materials/w1738wtyw0asanfq7zj2webc7d8awe77/jupiter-turbulent-atmosphere-normal-4e7a90-739af99fc6b85b69.png",
      roughness:
        "https://cdn.mint.gg/materials/w1738wtyw0asanfq7zj2webc7d8awe77/jupiter-turbulent-atmosphere-roughness-b9d19e-429d6d842599e606.png",
    },
    neptune: {
      baseColor:
        "https://cdn.mint.gg/materials/w1702d7zrmhc11qvc1s5ehczgs8aw6y1/neptune-methane-atmosphere-basecolor-fde0c0-1abb840ff9a11518.png",
      normal:
        "https://cdn.mint.gg/materials/w1702d7zrmhc11qvc1s5ehczgs8aw6y1/neptune-methane-atmosphere-normal-adafd5-64f7b3d353a3d31c.png",
      roughness:
        "https://cdn.mint.gg/materials/w1702d7zrmhc11qvc1s5ehczgs8aw6y1/neptune-methane-atmosphere-roughness-5fd42e-100508bfb4f03a7a.png",
    },
  },
  flybys: {
    cometBlue:
      "https://cdn.mint.gg/glb/blue-ice-comet-normalized-1490e4f56538d916.glb",
    cometGold:
      "https://cdn.mint.gg/glb/gold-dust-comet-normalized-8de2a2dfaf0a6634.glb",
    meteorEmber:
      "https://cdn.mint.gg/glb/ember-meteor-normalized-4c3c291ba1106af0.glb",
    meteorCold:
      "https://cdn.mint.gg/glb/cold-stone-meteor-normalized-60d59788f6f4c1b1.glb",
  },
  livingOrbit: {
    orbitalStation:
      "https://cdn.mint.gg/glb/human-orbital-research-station-normalized-e1f96745c1a02ca7.glb",
    outerSystemUfo:
      "https://cdn.mint.gg/glb/outer-system-ufo-normalized-4666158dcf26a941.glb",
  },
} as const;

export type OrbitPlanet = keyof typeof ORBIT_WEEK_MINT_ASSETS.planets;
