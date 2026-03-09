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

async function defaultGetProfile(accountId: AccountId): Promise<Profile | null> {
	const network = getNetworkFromAccountId(accountId);
	const apiBase = {
		mainnet: "https://api.near.social",
		testnet: "https://test.api.near.social",
	}[network];

	const keys = [`${accountId}/profile/**`];

	try {
		const response = await fetch(`${apiBase}/get`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ keys })
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json() as SocialApiResponse;
		const profile: Profile | undefined = data?.[accountId]?.profile;

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
