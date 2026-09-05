import { describe, expect, it } from "vitest";

import type { ResolveResult } from "@/engine";
import { defaultProviders, fetchDisplayMetadata } from "@/orpc/providers";
import type { Providers, WorkMetadata } from "@/orpc/providers";

const anime: ResolveResult = {
	continuityId: "continuity:1",
	mediaKind: "anime",
	segments: [
		{
			instalments: ["anidb:1#1"],
			kind: "episodic",
			members: { anidb: "1", tmdb: "tv:10" },
		},
	],
};

const film: ResolveResult = {
	continuityId: "continuity:2",
	mediaKind: "film",
	segments: [
		{
			instalments: ["tmdb:movie:1#1"],
			kind: "atomic",
			members: { tmdb: "movie:1" },
		},
	],
};

const metadata = (
	genres: readonly string[],
	extra: Partial<WorkMetadata> = {},
): WorkMetadata => ({
	backdropRef: undefined,
	cast: [],
	coverRef: undefined,
	genres,
	ifYouLiked: [],
	nativeTitle: undefined,
	productionStatus: undefined,
	runtimeMinutes: 24,
	segments: [],
	span: "",
	staff: [],
	studios: [],
	synopsis: "",
	title: "X",
	...extra,
});

const providersFor = (
	anidb: WorkMetadata,
	tmdb: WorkMetadata | Error,
): Providers => ({
	...defaultProviders,
	metadata: {
		...defaultProviders.metadata,
		anidb: {
			fetchWork: async () => {
				const work = await Promise.resolve(anidb);
				return work;
			},
		},
		tmdb: {
			fetchWork: async () => {
				if (tmdb instanceof Error) {
					throw tmdb;
				}
				const work = await Promise.resolve(tmdb);
				return work;
			},
		},
	},
});

describe("fetchDisplayMetadata", () => {
	it("keeps anime genres from anidb when they are present", async () => {
		const meta = await fetchDisplayMetadata(
			providersFor(metadata(["Comedy"]), metadata(["Drama"])),
			anime,
		);
		expect(meta.genres).toEqual(["Comedy"]);
		expect(meta.runtimeMinutes).toBe(24);
	});

	it("overlays tmdb genres when anidb has none", async () => {
		const meta = await fetchDisplayMetadata(
			providersFor(metadata([]), metadata(["Comedy", "Action"])),
			anime,
		);
		expect(meta.genres).toEqual(["Comedy", "Action"]);
		expect(meta.runtimeMinutes).toBe(24);
	});

	it("keeps anidb genres when tmdb fails", async () => {
		const meta = await fetchDisplayMetadata(
			providersFor(metadata(["Comedy"]), new Error("tmdb down")),
			anime,
		);
		expect(meta.genres).toEqual(["Comedy"]);
		expect(meta.runtimeMinutes).toBe(24);
	});

	it("drops anime genres when anidb has none and tmdb fails", async () => {
		const meta = await fetchDisplayMetadata(
			providersFor(metadata([]), new Error("tmdb down")),
			anime,
		);
		expect(meta.genres).toEqual([]);
		expect(meta.runtimeMinutes).toBe(24);
	});

	it("overlays tmdb networks, certification, and backdrop when anidb has genres", async () => {
		const meta = await fetchDisplayMetadata(
			providersFor(
				metadata(["Comedy"]),
				metadata(["Drama"], {
					backdropRef: "tmdb:/back.jpg",
					certification: "TV-14",
					networks: ["TV Tokyo"],
					tagline: "They have each other's backs.",
				}),
			),
			anime,
		);
		expect(meta.genres).toEqual(["Comedy"]);
		expect(meta.backdropRef).toBe("tmdb:/back.jpg");
		expect(meta.certification).toBe("TV-14");
		expect(meta.networks).toEqual(["TV Tokyo"]);
		expect(meta.tagline).toBe("They have each other's backs.");
		expect(meta.runtimeMinutes).toBe(24);
	});

	it("keeps anidb certification over tmdb", async () => {
		const meta = await fetchDisplayMetadata(
			providersFor(
				metadata(["Comedy"], { certification: "18+" }),
				metadata(["Drama"], { certification: "TV-MA" }),
			),
			anime,
		);
		expect(meta.certification).toBe("18+");
	});

	it("skips tmdb overlay when the continuity has no tmdb member", async () => {
		let tmdbCalls = 0;
		const anidbOnly: ResolveResult = {
			continuityId: "continuity:anidb-only",
			mediaKind: "anime",
			segments: [
				{
					instalments: ["anidb:1#1"],
					kind: "episodic",
					members: { anidb: "1" },
				},
			],
		};
		const providers = providersFor(
			metadata(["Comedy"]),
			metadata(["Drama"], { certification: "TV-MA" }),
		);
		const counting: Providers = {
			...providers,
			metadata: {
				...providers.metadata,
				tmdb: {
					fetchWork: () => {
						tmdbCalls += 1;
						return metadata(["Drama"], { certification: "TV-MA" });
					},
				},
			},
		};
		const meta = await fetchDisplayMetadata(counting, anidbOnly);
		expect(meta.genres).toEqual(["Comedy"]);
		expect(meta.certification).toBeUndefined();
		expect(tmdbCalls).toBe(0);
	});

	it("leaves film genres on the tmdb snapshot", async () => {
		const tmdb = metadata(["Science Fiction"]);
		const meta = await fetchDisplayMetadata(
			providersFor(metadata(["AniDB Tag"]), tmdb),
			film,
		);
		expect(meta.genres).toEqual(["Science Fiction"]);
	});
});
