import type { CatalogProduct } from "@/lib/products";

export type ArchiveMode = "inspect" | "lifted" | "exploded" | "compare";

export type ArchiveConfiguration = {
	materialId: string;
	colorwayId: string;
	size: string;
};

export type ArchiveSceneState = {
	product: CatalogProduct;
	configuration: ArchiveConfiguration;
	mode: ArchiveMode;
	compareProduct?: CatalogProduct;
};

export type SceneStatus = "initializing" | "ready" | "loading-model" | "fallback" | "unsupported";

export type SceneDiagnostics = {
	drawCalls: number;
	triangles: number;
	geometries: number;
	textures: number;
	dpr: number;
	usingMintModel: boolean;
};
