export const generatedCatalogAt = "template-seed";

export type GeneratedProduct = {
	slug: string;
	csvSlug: string;
	name: string;
	descriptionHtml: string;
	descriptionText: string;
	inStock: boolean;
	amount: number;
	currency: "USD";
	images: string[];
	imageAlts: string[];
	stripeProductId: string;
	stripePriceId: string;
};

export const generatedProducts: GeneratedProduct[] = [
	{
		slug: "everyday-tote",
		csvSlug: "everyday-tote",
		name: "Everyday Tote",
		descriptionHtml:
			"<p>A structured cotton canvas tote with interior pockets, reinforced handles, and a balanced size for errands, commutes, and weekend market runs.</p>",
		descriptionText:
			"A structured cotton canvas tote with interior pockets, reinforced handles, and a balanced size for errands, commutes, and weekend market runs.",
		inStock: true,
		amount: 6800,
		currency: "USD",
		images: ["https://cdn.mint.gg/images/models/everyday-tote-e7e38680279b2df1.webp"],
		imageAlts: ["Everyday Tote on a warm neutral product set"],
		stripeProductId: "prod_replace_everyday_tote",
		stripePriceId: "price_replace_everyday_tote",
	},
	{
		slug: "desk-lamp",
		csvSlug: "desk-lamp",
		name: "Desk Lamp",
		descriptionHtml:
			"<p>A low-profile task lamp with a powder-coated shade, warm LED output, and a compact base for shelves, desks, and bedside tables.</p>",
		descriptionText:
			"A low-profile task lamp with a powder-coated shade, warm LED output, and a compact base for shelves, desks, and bedside tables.",
		inStock: true,
		amount: 9200,
		currency: "USD",
		images: ["https://cdn.mint.gg/images/models/desk-lamp-6a1e6ae47dc1bb9d.webp"],
		imageAlts: ["Desk Lamp on a warm neutral product set"],
		stripeProductId: "prod_replace_desk_lamp",
		stripePriceId: "price_replace_desk_lamp",
	},
	{
		slug: "linen-notebook",
		csvSlug: "linen-notebook",
		name: "Linen Notebook",
		descriptionHtml:
			"<p>A clothbound notebook with lay-flat binding, smooth ivory pages, and a compact format for planning, sketching, and field notes.</p>",
		descriptionText:
			"A clothbound notebook with lay-flat binding, smooth ivory pages, and a compact format for planning, sketching, and field notes.",
		inStock: true,
		amount: 2400,
		currency: "USD",
		images: ["https://cdn.mint.gg/images/models/linen-notebook-3096e2df0a15ef2b.webp"],
		imageAlts: ["Linen Notebook on a warm neutral product set"],
		stripeProductId: "prod_replace_linen_notebook",
		stripePriceId: "price_replace_linen_notebook",
	},
	{
		slug: "ceramic-mug",
		csvSlug: "ceramic-mug",
		name: "Ceramic Mug",
		descriptionHtml:
			"<p>A generous stoneware mug with a matte exterior, clear-glazed interior, and comfortable handle for the daily first cup.</p>",
		descriptionText:
			"A generous stoneware mug with a matte exterior, clear-glazed interior, and comfortable handle for the daily first cup.",
		inStock: true,
		amount: 3200,
		currency: "USD",
		images: ["https://cdn.mint.gg/images/models/ceramic-mug-ae7622d92575f546.webp"],
		imageAlts: ["Ceramic Mug on a warm neutral product set"],
		stripeProductId: "prod_replace_ceramic_mug",
		stripePriceId: "price_replace_ceramic_mug",
	},
	{
		slug: "woven-throw",
		csvSlug: "woven-throw",
		name: "Woven Throw",
		descriptionHtml:
			"<p>A medium-weight cotton throw with a soft handfeel, subtle texture, and tidy edge finish for sofas, reading chairs, and guest rooms.</p>",
		descriptionText:
			"A medium-weight cotton throw with a soft handfeel, subtle texture, and tidy edge finish for sofas, reading chairs, and guest rooms.",
		inStock: true,
		amount: 7800,
		currency: "USD",
		images: ["https://cdn.mint.gg/images/models/woven-throw-05cd2851ac8e2b9c.webp"],
		imageAlts: ["Woven Throw on a warm neutral product set"],
		stripeProductId: "prod_replace_woven_throw",
		stripePriceId: "price_replace_woven_throw",
	},
	{
		slug: "storage-tray",
		csvSlug: "storage-tray",
		name: "Storage Tray",
		descriptionHtml:
			"<p>A shallow catchall tray with softened edges and a satin finish for keys, desk tools, jewelry, or entryway essentials.</p>",
		descriptionText:
			"A shallow catchall tray with softened edges and a satin finish for keys, desk tools, jewelry, or entryway essentials.",
		inStock: true,
		amount: 4200,
		currency: "USD",
		images: ["https://cdn.mint.gg/images/models/storage-tray-7c4a65d4db8e42d7.webp"],
		imageAlts: ["Storage Tray on a warm neutral product set"],
		stripeProductId: "prod_replace_storage_tray",
		stripePriceId: "price_replace_storage_tray",
	},
];
