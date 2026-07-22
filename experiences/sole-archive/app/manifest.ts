import type { MetadataRoute } from "next";
import { STORE_DESCRIPTION, STORE_NAME, storeAssets } from "@/lib/store";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: STORE_NAME,
		short_name: STORE_NAME,
		description: STORE_DESCRIPTION,
		start_url: "/",
		display: "standalone",
		background_color: "#111411",
		theme_color: "#c7ff1a",
		icons: [
			{
				src: storeAssets.favicon,
				sizes: "any",
				type: "image/png",
			},
		],
	};
}
