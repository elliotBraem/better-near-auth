import { describe, expect, it } from "vitest";
import { atom, type WritableAtom } from "nanostores";
import { getNearAtoms, type NearState } from "./store.js";

function createClient(atoms: Record<string, WritableAtom<any>>) {
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
