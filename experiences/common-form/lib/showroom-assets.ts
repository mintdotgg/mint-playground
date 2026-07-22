export const showroomAssets = {
	fixtures: [
		{
			label: "Gallery plinth",
			path: "https://cdn.mint.gg/glb/gallery-plinth-normalized-b54c63d2ed2f65a7.glb",
			targetHeight: 0.62,
			position: [-4.1, -0.52, -1.35],
			rotationY: 0.28,
		},
		{
			label: "Ribbed screen",
			path: "https://cdn.mint.gg/glb/ribbed-screen-normalized-5b6430db4ad24164.glb",
			targetHeight: 3.25,
			position: [-4.25, -0.52, -2.7],
			rotationY: 0.18,
		},
		{
			label: "Arc light",
			path: "https://cdn.mint.gg/glb/arc-light-normalized-e9ad54ff1c80c418.glb",
			targetHeight: 3.55,
			position: [4.15, -0.52, -2.4],
			rotationY: -0.2,
		},
	] as const,
	products: [
		{
			slug: "everyday-tote",
			path: "https://cdn.mint.gg/glb/everyday-tote-normalized-d0e328a87442fb9f.glb",
			targetSize: 1.72,
			rotationY: -0.18,
		},
		{
			slug: "desk-lamp",
			path: "https://cdn.mint.gg/glb/desk-lamp-normalized-1961e12c99febd0e.glb",
			targetSize: 1.58,
			rotationY: -0.28,
		},
		{
			slug: "linen-notebook",
			path: "https://cdn.mint.gg/glb/linen-notebook-normalized-4c24352e524e75d7.glb",
			targetSize: 1.34,
			rotationY: -0.32,
		},
		{
			slug: "ceramic-mug",
			path: "https://cdn.mint.gg/glb/ceramic-mug-normalized-b3cc001e00459896.glb",
			targetSize: 1.08,
			rotationY: -0.25,
		},
		{
			slug: "woven-throw",
			path: "https://cdn.mint.gg/glb/woven-throw-normalized-b2fb13844950ff26.glb",
			targetSize: 1.44,
			rotationY: -0.24,
		},
		{
			slug: "storage-tray",
			path: "https://cdn.mint.gg/glb/storage-tray-normalized-9821a9f6ebbd0538.glb",
			targetSize: 1.46,
			rotationY: -0.3,
		},
	] as const,
	audio: {
		ambience: "https://cdn.mint.gg/audio/xd7bsh906ks660tfc9h5037gs58az395/common-form-showroom-ambience-779525-4b0d4c03f2650330.mp3",
		selection: "https://cdn.mint.gg/audio/xd71wndvq772mx206t8shttzf98azvkk/common-form-selection-cue-4dccad-1c8114efa2cd9d7b.mp3",
	},
} as const;
