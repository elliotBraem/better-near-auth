import { describe, expect, it } from "vitest";
import { atom, type WritableAtom } from "nanostores";
import { getNearAtoms, readSessionNearAccountId, type NearState } from "./store.js";

function createClient(atoms: Record<string, WritableAtom<unknown>>) {
	return { $store: { atoms } };
}

describe("getNearAtoms", () => {
	it("returns the siwnClient atoms from the client store", () => {
		const nearState = atom<NearState>(null);
		const walletConnected = atom<boolean>(false);
		const activeNetwork = atom<"mainnet" | "testnet">("mainnet");

		const atoms = getNearAtoms(createClient({ nearState, walletConnected, activeNetwork }));

		expect(atoms.nearState).toBe(nearState);
		expect(atoms.walletConnected).toBe(walletConnected);
		expect(atoms.activeNetwork).toBe(activeNetwork);
	});

	it("reads and writes through the same atom instances", () => {
		const nearState = atom<NearState>(null);
		const { nearState: typed } = getNearAtoms(
			createClient({ nearState, walletConnected: atom(false), activeNetwork: atom("testnet") }),
		);

		typed.set({ accountId: "alice.near", publicKey: "pk", networkId: "mainnet" });
		expect(nearState.get()).toEqual({ accountId: "alice.near", publicKey: "pk", networkId: "mainnet" });
	});

	it("throws when siwnClient is not part of the client plugins", () => {
		expect(() => getNearAtoms({})).toThrow(/siwnClient/);
		expect(() => getNearAtoms(createClient({}))).toThrow(/siwnClient/);
		expect(() => getNearAtoms(createClient({ nearState: atom(null) }))).toThrow(/siwnClient/);
	});
});

describe("readSessionNearAccountId", () => {
	it("returns the primary linked account from the session", () => {
		const session = {
			data: {
				user: {
					id: "user-1",
					nearAccount: { accountId: "alice.near", network: "mainnet", isPrimary: true },
				},
			},
		};
		expect(readSessionNearAccountId(session)).toBe("alice.near");
	});

	it("returns null for missing, cleared, or malformed sessions", () => {
		expect(readSessionNearAccountId(null)).toBeNull();
		expect(readSessionNearAccountId(undefined)).toBeNull();
		expect(readSessionNearAccountId({ data: null })).toBeNull();
		expect(readSessionNearAccountId({ data: { user: {} } })).toBeNull();
		expect(readSessionNearAccountId({ data: { user: { nearAccount: { accountId: 123 } } } })).toBeNull();
		expect(readSessionNearAccountId("not a session")).toBeNull();
	});
});
