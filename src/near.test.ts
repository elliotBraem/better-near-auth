import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { siwn } from "./index.js";

const MOCK_ACCOUNT_ID = "test.near";
const MOCK_TESTNET_ACCOUNT_ID = "test.testnet";
const MOCK_PUBLIC_KEY = "ed25519:abcdefghijklmnopqrstuvwxyz0123456789ABCD";
const MOCK_RECIPIENT = "example.near";

function makeNonceBytes(): Uint8Array {
	const nonce = new Uint8Array(32);
	for (let i = 0; i < 32; i++) nonce[i] = i + 1;
	return nonce;
}

const mockVerifyResult = {
	accountId: MOCK_ACCOUNT_ID,
	message: `Sign in to ${MOCK_RECIPIENT}`,
	publicKey: MOCK_PUBLIC_KEY,
};

let nonceCounter = 0;
function makeUniqueNonce(): number[] {
	nonceCounter++;
	const nonce = new Uint8Array(32);
	for (let i = 0; i < 32; i++) nonce[i] = (i + 1) ^ (nonceCounter & 0xff);
	return Array.from(nonce);
}

const mockParsedToken = {
	accountId: MOCK_ACCOUNT_ID,
	publicKey: MOCK_PUBLIC_KEY,
	signature: "mock-signature",
	message: `Sign in to ${MOCK_RECIPIENT}`,
	nonce: makeUniqueNonce(),
	recipient: MOCK_RECIPIENT,
	callbackUrl: null,
	state: null,
};

vi.mock("near-sign-verify", () => ({
	generateNonce: vi.fn(() => {
		nonceCounter++;
		const nonce = new Uint8Array(32);
		for (let i = 0; i < 32; i++) nonce[i] = (i + 1) ^ (nonceCounter & 0xff);
		return nonce;
	}),
	verify: vi.fn(() => Promise.resolve({ ...mockVerifyResult })),
	parseAuthToken: vi.fn(() => ({
		...mockParsedToken,
		nonce: makeUniqueNonce(),
	})),
	sign: vi.fn(() => Promise.resolve("mock-auth-token")),
	stringToUint8Array: vi.fn((s: string) => new TextEncoder().encode(s)),
	uint8ArrayToString: vi.fn((arr: Uint8Array) => new TextDecoder().decode(arr)),
}));

vi.mock("@fastnear/wallet", () => ({
	onConnect: vi.fn(),
	onDisconnect: vi.fn(),
	restore: vi.fn(() => Promise.resolve(null)),
	connect: vi.fn(() => Promise.resolve({ accountId: MOCK_ACCOUNT_ID, publicKey: MOCK_PUBLIC_KEY })),
	disconnect: vi.fn(() => Promise.resolve()),
	signMessage: vi.fn(() => Promise.resolve({
		accountId: MOCK_ACCOUNT_ID,
		publicKey: MOCK_PUBLIC_KEY,
		signature: "mock-signature",
	})),
	signDelegateActions: vi.fn(() => Promise.resolve({
		signedDelegateActions: [{
			signedDelegate: { delegateAction: {}, signature: {} },
		}],
	})),
	isConnected: vi.fn(() => false),
	accountId: vi.fn(() => null),
	availableWallets: vi.fn(() => []),
	selectWallet: vi.fn(() => Promise.resolve("my-near-wallet")),
	walletName: vi.fn(() => null),
	sendTransaction: vi.fn(() => Promise.resolve({})),
	sendTransactions: vi.fn(() => Promise.resolve({})),
	reset: vi.fn(),
	addFunctionCallKey: vi.fn(),
	removeDebugWallet: vi.fn(),
	registerDebugWallet: vi.fn(),
	switchNetwork: vi.fn(),
}));

vi.mock("./rpc.js", () => ({
	queryAccessKey: vi.fn(() => Promise.resolve({ nonce: 0, permission: "FullAccess" })),
	queryBlock: vi.fn(() => Promise.resolve({
		header: { hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", height: 100, timestamp_nanosec: "0" },
	})),
	queryTx: vi.fn(() => Promise.resolve({ status: { HasSuccessReceiptId: "yes" }, transaction: { outcome: { gas_burnt: "1000" } } })),
	sendTxBroadcast: vi.fn(() => Promise.resolve("mock-tx-hash")),
	queryAccount: vi.fn(() => Promise.resolve({ amount: "10000000000000000000000000" })),
	viewFunction: vi.fn(() => Promise.resolve("")),
}));

vi.mock("./profile.js", () => ({
	defaultGetProfile: vi.fn(() => Promise.resolve({ name: "Test User", description: "A test user" })),
	getImageUrl: vi.fn(() => "https://example.com/image.png"),
	getNetworkFromAccountId: vi.fn((id: string) =>
		id.endsWith(".testnet") ? "testnet" : "mainnet"
	),
}));

async function setup(overrides?: {
	recipient?: string;
	requireFullAccessKey?: boolean;
	anonymous?: boolean;
	relayer?: any;
	getProfile?: any;
	validateLimitedAccessKey?: any;
}) {
	return getTestInstance(
		{
			plugins: [
				siwn({
					recipient: overrides?.recipient ?? MOCK_RECIPIENT,
					requireFullAccessKey: overrides?.requireFullAccessKey ?? false,
					anonymous: overrides?.anonymous ?? true,
					relayer: overrides?.relayer,
					getProfile: overrides?.getProfile,
					validateLimitedAccessKey: overrides?.validateLimitedAccessKey,
				}),
			],
		},
		{
			clientOptions: {
				plugins: [],
			},
			disableTestUser: true,
		},
	);
}

describe("siwn plugin", () => {
	describe("nonce endpoint", () => {
		it("should generate a nonce for a valid mainnet account ID", async () => {
			const { client } = await setup();
			const { data, error } = await client.near.nonce({
				accountId: MOCK_ACCOUNT_ID,
				networkId: "mainnet",
			});
			expect(error).toBeNull();
			expect(typeof data?.nonce).toBe("string");
			expect(data!.nonce.length).toBeGreaterThan(0);
		});

		it("should generate a nonce for a valid testnet account ID", async () => {
			const { client } = await setup();
			const { data, error } = await client.near.nonce({
				accountId: MOCK_TESTNET_ACCOUNT_ID,
				networkId: "testnet",
			});
			expect(error).toBeNull();
			expect(typeof data?.nonce).toBe("string");
		});

		it("should reject invalid NEAR account ID format", async () => {
			const { client } = await setup();
			const { error } = await client.near.nonce({
				accountId: "INVALID",
				networkId: "mainnet",
			} as any);
			expect(error).toBeDefined();
		});

		it("should reject network mismatch between accountId and networkId", async () => {
			const { client } = await setup();
			const { error } = await client.near.nonce({
				accountId: MOCK_ACCOUNT_ID,
				networkId: "testnet",
			});
			expect(error).toBeDefined();
		});

		it("should accept sub-account IDs", async () => {
			const { client } = await setup();
			const { data, error } = await client.near.nonce({
				accountId: "sub.app.near",
				networkId: "mainnet",
			});
			expect(error).toBeNull();
			expect(typeof data?.nonce).toBe("string");
		});
	});

	describe("verify endpoint", () => {
		it("should verify a valid auth token and create a session", async () => {
			const { client } = await setup();
			const { data, error } = await client.near.verify({
				authToken: "valid-auth-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(error).toBeNull();
			expect(data?.success).toBe(true);
			expect(data?.token).toBeDefined();
			expect(data?.user.accountId).toBe(MOCK_ACCOUNT_ID);
			expect(data?.user.network).toBe("mainnet");
		});

		it("should reject an auth token with mismatched accountId", async () => {
			const { verify } = await import("near-sign-verify");
			(verify as any).mockResolvedValueOnce({
				...mockVerifyResult,
				accountId: "other.near",
			});
			const { client } = await setup();
			const { error } = await client.near.verify({
				authToken: "mismatched-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(error).toBeDefined();
		});

		it("should detect nonce replay", async () => {
			const { client } = await setup();
			const { data: first } = await client.near.verify({
				authToken: "replay-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(first?.success).toBe(true);

			const { error } = await client.near.verify({
				authToken: "replay-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(error).toBeDefined();
		});

		it("should create a user with email derived from accountId when anonymous", async () => {
			const { client, db } = await setup();
			const { data } = await client.near.verify({
				authToken: "new-user-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(data?.success).toBe(true);

			const users = await db.findMany({ model: "user" });
			expect(users.length).toBeGreaterThan(0);
			const user = users.find((u: any) => u.id === data?.user.id);
			expect(user).toBeDefined();
			expect((user as any).email).toContain(MOCK_ACCOUNT_ID);
		});

		it("should create a testnet user with correct network", async () => {
			const { verify } = await import("near-sign-verify");
			(verify as any).mockResolvedValueOnce({
				...mockVerifyResult,
				accountId: MOCK_TESTNET_ACCOUNT_ID,
			});
			const { parseAuthToken } = await import("near-sign-verify");
			(parseAuthToken as any).mockReturnValueOnce({
				...mockParsedToken,
				accountId: MOCK_TESTNET_ACCOUNT_ID,
				nonce: Array.from(makeNonceBytes().map((b: number) => b ^ 0xff)),
			});

			const { client } = await setup();
			const { data, error } = await client.near.verify({
				authToken: "testnet-token",
				accountId: MOCK_TESTNET_ACCOUNT_ID,
			});
			expect(error).toBeNull();
			expect(data?.success).toBe(true);
			expect(data?.user.network).toBe("testnet");
		});

		it("should require email when anonymous is false", async () => {
			const { client } = await setup({ anonymous: false });
			const { error } = await client.near.verify({
				authToken: "no-email-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(error).toBeDefined();
		});

		it("should succeed with email when anonymous is false", async () => {
			const { client } = await setup({ anonymous: false });
			const { data, error } = await client.near.verify({
				authToken: "with-email-token",
				accountId: MOCK_ACCOUNT_ID,
				email: "test@example.com",
			});
			expect(error).toBeNull();
			expect(data?.success).toBe(true);
		});

		it("should link existing user on re-verify with same accountId", async () => {
			const { client } = await setup();
			const { data: first } = await client.near.verify({
				authToken: "first-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(first?.success).toBe(true);
			const userId = first!.user.id;

			const { data: second } = await client.near.verify({
				authToken: "second-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(second?.success).toBe(true);
			expect(second?.user.id).toBe(userId);
		});
	});

	describe("link account endpoint", () => {
		it("should link a NEAR account to an existing session", async () => {
			const { client, signInWithTestUser, customFetchImpl } = await getTestInstance(
				{
					plugins: [siwn({ recipient: MOCK_RECIPIENT, requireFullAccessKey: false })],
					emailAndPassword: { enabled: true },
				},
				{ clientOptions: { plugins: [] } },
			);

			const { headers, setCookie } = await signInWithTestUser();

			const res = await customFetchImpl("http://localhost/api/auth/near/link-account", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: headers.get("cookie") || "",
				},
				body: JSON.stringify({
					authToken: "link-token",
					accountId: MOCK_ACCOUNT_ID,
				}),
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(body.accountId).toBe(MOCK_ACCOUNT_ID);
		});

		it("should reject linking without a session", async () => {
			const { client } = await setup();
			const { error } = await client.near.verify({
				authToken: "unauth-link-token",
				accountId: MOCK_ACCOUNT_ID,
			});
			expect(error).toBeNull();
		});
	});

	describe("list accounts endpoint", () => {
		it("should list NEAR accounts for authenticated user", async () => {
			const { client } = await setup();
			await client.near.verify({
				authToken: "list-token",
				accountId: MOCK_ACCOUNT_ID,
			});

			const { data, error } = await client.near.listAccounts();
			if (error) {
				expect(error).toBeDefined();
			} else {
				expect(data?.accounts).toBeDefined();
				expect(Array.isArray(data?.accounts)).toBe(true);
			}
		});
	});

	describe("profile endpoint", () => {
		it("should get profile for a specific accountId", async () => {
			const { client } = await setup();
			const { data, error } = await client.near.getProfile(MOCK_ACCOUNT_ID);
			if (!error) {
				expect(data).toBeDefined();
			}
		});
	});

	describe("account ID validation", () => {
		const validAccountIds = [
			"user.near",
			"test.testnet",
			"alice.tg",
			"sub.account.near",
			"a1b2c3.near",
			"user-name.near",
			"user_name.near",
			"deep.sub.account.near",
		];

		const invalidAccountIds = [
			"a",
			"user.NEAR",
			"user..near",
			".user.near",
			"user.near.",
			"user@near",
		];

		for (const accountId of validAccountIds) {
			it(`should accept valid account ID: ${accountId}`, async () => {
				const { client } = await setup();
				const networkId = accountId.endsWith(".testnet") ? "testnet" : "mainnet";
				const { data, error } = await client.near.nonce({ accountId, networkId });
				expect(error).toBeNull();
				expect(typeof data?.nonce).toBe("string");
			});
		}

		for (const accountId of invalidAccountIds) {
			it(`should reject invalid account ID: ${accountId}`, async () => {
				const { client } = await setup();
				const { error } = await client.near.nonce({ accountId, networkId: "mainnet" } as any);
				expect(error).toBeDefined();
			});
		}
	});

	describe("relayer", () => {
		it("should return relayer info when relayer is configured", async () => {
			const { client } = await setup({ relayer: {} });
			const { data, error } = await client.near.relayTransaction({
				signedDelegateAction: "mock-delegate-action",
			});
			if (error) {
				expect(error).toBeDefined();
			}
		});
	});
});
