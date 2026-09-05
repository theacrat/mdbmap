import type { ResolveResult } from "@/engine";
import { metadataProviderFor } from "@/engine";

import type { MetadataFetchOptions } from "./metadata-freshness.ts";
import type { Providers, WorkMetadata } from "./types.ts";

const overlayAnime = (
	anidb: WorkMetadata,
	tmdb: WorkMetadata,
): WorkMetadata => ({
	...anidb,
	backdropRef: anidb.backdropRef ?? tmdb.backdropRef,
	certification: anidb.certification ?? tmdb.certification,
	genres: anidb.genres.length > 0 ? [...anidb.genres] : [...tmdb.genres],
	networks:
		anidb.networks === undefined || anidb.networks.length === 0
			? tmdb.networks
			: [...anidb.networks],
	tagline: anidb.tagline ?? tmdb.tagline,
});

const fetchDisplayMetadata = async (
	providers: Providers,
	resolved: ResolveResult,
	options: MetadataFetchOptions = {},
): Promise<WorkMetadata> => {
	const kindProvider =
		providers.metadata[metadataProviderFor(resolved.mediaKind)];
	if (resolved.mediaKind !== "anime") {
		return kindProvider.fetchWork(resolved, options);
	}
	const meta = await kindProvider.fetchWork(resolved, options);
	const hasTmdbMember = resolved.segments.some(
		(segment) => segment.members.tmdb !== undefined,
	);
	if (!hasTmdbMember) {
		return meta;
	}
	try {
		const tmdb = await providers.metadata.tmdb.fetchWork(resolved, {
			force: options.force === true,
			refreshIfDue: false,
			...(options.locale === undefined ? {} : { locale: options.locale }),
			...(options.now === undefined ? {} : { now: options.now }),
		});
		return overlayAnime(meta, tmdb);
	} catch {
		return meta;
	}
};

export { fetchDisplayMetadata };
