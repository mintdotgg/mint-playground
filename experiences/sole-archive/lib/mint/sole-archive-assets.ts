import runtimeManifest from "@/lib/mint/manifests/sole-archive.runtime.json";

export const soleArchiveAssets = runtimeManifest;

export type SoleArchiveMaterialId = keyof typeof runtimeManifest.materials;
export type SoleArchiveMaterialAssets = {
	baseColor: string;
	normal?: string;
	roughness?: string;
};

export function getMintMaterialId(materialId: string): SoleArchiveMaterialId {
	if (materialId === "translucent-ripstop") return "smoked-polycarbonate";
	if (materialId === "nappa-leather") return "coated-leather";
	if (materialId in runtimeManifest.materials) return materialId as SoleArchiveMaterialId;
	return "ballistic-mesh";
}

export function getMintMaterialAssets(materialId: string) {
	const resolvedId = getMintMaterialId(materialId);
	return runtimeManifest.materials[resolvedId] as SoleArchiveMaterialAssets;
}
