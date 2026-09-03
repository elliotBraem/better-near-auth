import type { WritableAtom } from "nanostores";

export type NearNetwork = "mainnet" | "testnet";

export type NearState = {
	accountId: string | null;
	publicKey: string | null;
	networkId: string;
} | null;

export type NearClientAtoms = {
	nearState: WritableAtom<NearState>;
	walletConnected: WritableAtom<boolean>;
	activeNetwork: WritableAtom<NearNetwork>;
};

export type NearAtomsSource = {
	$store?: { atoms?: Record<string, WritableAtom<unknown>> } | null;
};

export function getNearAtoms(client: NearAtomsSource): NearClientAtoms {
	const atoms = client?.$store?.atoms;
	if (!atoms?.nearState || !atoms.walletConnected || !atoms.activeNetwork) {
		throw new Error("Missing near atoms — add siwnClient() to your createAuthClient plugins");
	}
	// The store record erases atom value types — siwnClient() guarantees these shapes.
	return atoms as unknown as NearClientAtoms;
}

/**
 * Read the primary SIWN-linked account ID (`session.user.nearAccount`) from a
 * better-auth session-atom value. The `nearAccount` field is populated by an
 * `after` hook on `GET /auth/session`, so it is not part of the inferred
 * session user type — this helper narrows it in one place, shared by
 * `getAccountId()` and the React hooks.
 */
export function readSessionNearAccountId(session: unknown): string | null {
	const accountId = (session as { data?: { user?: { nearAccount?: { accountId?: unknown } } } } | null | undefined)
		?.data?.user?.nearAccount?.accountId;
	return typeof accountId === "string" ? accountId : null;
}
