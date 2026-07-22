export type ShowroomProfile = {
	collection: string;
	material: string;
	accent: number;
	note: string;
};

const defaultProfile: ShowroomProfile = {
	collection: "Studio object",
	material: "Mixed material",
	accent: 0xb75338,
	note: "Designed to settle naturally into the rhythms of a considered home.",
};

const profiles: Record<string, ShowroomProfile> = {
	"everyday-tote": {
		collection: "Carry / 01",
		material: "Structured cotton",
		accent: 0xa94935,
		note: "A graphic daily carry with enough structure to keep its composure from commute to market.",
	},
	"desk-lamp": {
		collection: "Light / 02",
		material: "Powder-coated steel",
		accent: 0xd3843b,
		note: "A quiet pool of warm task light, shaped to disappear into the edge of a desk or shelf.",
	},
	"linen-notebook": {
		collection: "Write / 03",
		material: "Linen and ivory paper",
		accent: 0x877a62,
		note: "Clothbound, compact, and ready to lie flat wherever an unfinished idea finds you.",
	},
	"ceramic-mug": {
		collection: "Table / 04",
		material: "Matte stoneware",
		accent: 0x9f5c43,
		note: "Generous in the hand, with a soft matte shell and a clear-glazed interior for the first cup.",
	},
	"woven-throw": {
		collection: "Textile / 05",
		material: "Woven cotton",
		accent: 0xb36b4b,
		note: "A medium-weight layer with a subtle woven rhythm and an easy, unprecious softness.",
	},
	"storage-tray": {
		collection: "Organize / 06",
		material: "Satin-finished wood",
		accent: 0x6e765f,
		note: "A low landscape for the small objects that otherwise drift across desks and entryways.",
	},
};

export function getShowroomProfile(slug: string) {
	return profiles[slug] ?? defaultProfile;
}
