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
	$store?: { atoms?: Record<string, WritableAtom<any>> } | null;
};

export function getNearAtoms(client: NearAtomsSource): NearClientAtoms {
	const atoms = client?.$store?.atoms;
	const { nearState, walletConnected, activeNetwork } = atoms ?? {};
	if (!nearState || !walletConnected || !activeNetwork) {
		throw new Error("Missing near atoms — add siwnClient() to your createAuthClient plugins");
	}
	return {
		nearState: nearState as WritableAtom<NearState>,
		walletConnected: walletConnected as WritableAtom<boolean>,
		activeNetwork: activeNetwork as WritableAtom<NearNetwork>,
	};
}
