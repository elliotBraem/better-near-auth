import type { AccountId, Profile, SocialImage } from "./types.js";

const FALLBACK_URL =
	"https://ipfs.near.social/ipfs/bafkreidn5fb2oygegqaldx7ycdmhu4owcrmoxd7ekbzfmeakkobz2ja7qy";

function getNetworkFromAccountId(accountId: string): "mainnet" | "testnet" {
	return accountId.endsWith('.testnet') ? 'testnet' : 'mainnet';
}

function getImageUrl(
	image: SocialImage | undefined,
	fallback?: string,
): string {
	if (image?.url) return image.url;
	if (image?.ipfs_cid) return `https://ipfs.near.social/ipfs/${image.ipfs_cid}`;
	return fallback || FALLBACK_URL;
}

interface SocialApiResponse {
	[accountId: string]: {
		profile?: Profile;
	};
}

interface KvEntry {
	value: Record<string, unknown> | string;
	block_height?: number;
	block_hash?: string;
	timestamp_nanosec?: string;
}

interface KvResponse {
	entries: KvEntry[];
}

async function defaultGetProfile(accountId: AccountId, apiKey?: string): Promise<Profile | null> {
	const network = getNetworkFromAccountId(accountId);

	try {
		const kvUrl = network === "testnet"
			? "https://kv.test.fastnear.com"
			: "https://kv.main.fastnear.com";

		const effectiveApiKey = apiKey || process.env.FASTNEAR_API_KEY;
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (effectiveApiKey) {
			headers["Authorization"] = `Bearer ${effectiveApiKey}`;
		}

		const response = await fetch(
			`${kvUrl}/v0/latest/social.near/${accountId}/profile/**`,
			{ headers },
		);

		if (response.ok) {
			const data = await response.json() as KvResponse;
			const entry = data?.entries?.[0];
			if (entry?.value) {
				try {
					const profile = typeof entry.value === "string"
						? JSON.parse(entry.value)
						: entry.value;
					if (profile?.name || profile?.description || profile?.image) {
						return {
							name: profile.name,
							description: profile.description,
							image: profile.image,
							backgroundImage: profile.backgroundImage,
							linktree: profile.linktree,
						};
					}
				} catch {}
			}
		}

		const apiBase = {
			mainnet: "https://api.near.social",
			testnet: "https://test.api.near.social",
		}[network];

		const keys = [`${accountId}/profile/**`];

		const fallbackResponse = await fetch(`${apiBase}/get`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ keys })
		});

		if (!fallbackResponse.ok) {
			throw new Error(`HTTP error! status: ${fallbackResponse.status}`);
		}

		const fallbackData = await fallbackResponse.json() as SocialApiResponse;
		const profile: Profile | undefined = fallbackData?.[accountId]?.profile;

		if (profile) {
			return {
				name: profile.name,
				description: profile.description,
				image: profile.image,
				backgroundImage: profile.backgroundImage,
				linktree: profile.linktree
			};
		}
		return null;
	} catch (error) {
		return null;
	}
}

export { defaultGetProfile, getImageUrl, getNetworkFromAccountId };
