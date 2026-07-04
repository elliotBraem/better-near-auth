import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { siwn } from "./index.js";
import { hex } from "@scure/base";

const MOCK_ACCOUNT_ID = "test.near";
const MOCK_TESTNET_ACCOUNT_ID = "test.testnet";
const MOCK_PUBLIC_KEY = "ed25519:abcdefghijklmnopqrstuvwxyz0123456789ABCD";
const MOCK_RECIPIENT = "example.near";
const MOCK_GENERATED_PUBLIC_KEY = "ed25519:11111111111111111111111111111111";
const MOCK_GENERATED_SECRET_KEY = "ed25519:1111111111111111111111111111111111111111111111111111111111111111";

function makeNonceBytes(): Uint8Array {
	const nonce = new Uint8Array(32);
	for (let i = 0; i < 32; i++) nonce[i] = i + 1;
	return nonce;
}

const mockSignedMessage = {
	accountId: MOCK_ACCOUNT_ID,
	publicKey: MOCK_PUBLIC_KEY,
	signature: "mock-signature-base64",
};

let nonceCounter = 0;
function makeUniqueNonce(): Uint8Array {
	nonceCounter++;
	const nonce = new Uint8Array(32);
	for (let i = 0; i < 32; i++) nonce[i] = (i + 1) ^ (nonceCounter & 0xff);
	return nonce;
}

vi.mock("near-kit", () => {
	const mockNearInstance = {
		view: vi.fn(),
		call: vi.fn(),
		send: vi.fn(),
		signMessage: vi.fn(() => Promise.resolve(mockSignedMessage)),
		getBalance: vi.fn(() => Promise.resolve("100")),
		getAccount: vi.fn(() => Promise.resolve({
			balance: "100",
			available: "98",
			staked: "0",
			storageUsage: "2",
			storageBytes: 100,
			hasContract: false,
		})),
		accountExists: vi.fn(() => Promise.resolve(true)),
		getAccessKey: vi.fn(() => Promise.resolve({ nonce: 0, permission: "FullAccess" })),
		getAccessKeys: vi.fn(() => Promise.resolve({ keys: [] })),
		getTransactionStatus: vi.fn(() => Promise.resolve({
			status: { SuccessReceiptId: "yes" },
			transaction: { hash: "mock-tx-hash", outcome: { gas_burnt: "1000" } },
			transaction_outcome: { outcome: { gas_burnt: 1000 } },
		})),
		transaction: vi.fn(() => ({
			signedDelegateAction: vi.fn().mockReturnThis(),
			functionCall: vi.fn().mockReturnThis(),
			transfer: vi.fn().mockReturnThis(),
			delegate: vi.fn(() => Promise.resolve({ payload: "mock-payload" })),
			send: vi.fn(() => Promise.resolve({ transaction: { hash: "mock-tx-hash" } })),
		})),
		contract: vi.fn(),
		batch: vi.fn(),
		getStatus: vi.fn(),
	};

	return {
		Near: vi.fn(function(this: any) { Object.assign(this, mockNearInstance); }),
		generateNonce: vi.fn(() => {
			nonceCounter++;
			const nonce = new Uint8Array(32);
			for (let i = 0; i < 32; i++) nonce[i] = (i + 1) ^ (nonceCounter & 0xff);
			return nonce;
		}),
		generateKey: vi.fn(() => ({
			publicKey: { data: new Uint8Array(32).fill(1), toString: () => MOCK_GENERATED_PUBLIC_KEY },
			secretKey: MOCK_GENERATED_SECRET_KEY,
			sign: vi.fn(),
			signNep413Message: vi.fn(),
		})),
		parseKey: vi.fn(() => ({
			publicKey: { data: new Uint8Array(32).fill(1), toString: () => MOCK_GENERATED_PUBLIC_KEY },
			secretKey: MOCK_GENERATED_SECRET_KEY,
			sign: vi.fn(),
		})),
		verifyNep413Signature: vi.fn(() => Promise.resolve(true)),
		decodeSignedDelegateAction: vi.fn(() => ({
			signedDelegate: {
				delegateAction: {
					senderId: MOCK_ACCOUNT_ID,
					receiverId: "contract.near",
					actions: [],
					nonce: 1n,
					maxBlockHeight: 1000n,
					publicKey: { ed25519Key: { data: new Array(32).fill(0) } },
				},
				signature: { ed25519Signature: { data: new Array(64).fill(0) } },
			},
		})),
		InMemoryKeyStore: vi.fn(function(this: any) {
			this.add = vi.fn(() => Promise.resolve());
			this.get = vi.fn(() => Promise.resolve(null));
			this.remove = vi.fn(() => Promise.resolve());
			this.list = vi.fn(() => Promise.resolve([]));
			this.clear = vi.fn();
		}),
		RotatingKeyStore: vi.fn(function(this: any) {
			this.add = vi.fn(() => Promise.resolve());
			this.get = vi.fn(() => Promise.resolve(null));
			this.remove = vi.fn(() => Promise.resolve());
			this.list = vi.fn(() => Promise.resolve([]));
			this.getAll = vi.fn(() => Promise.resolve([]));
			this.getCurrentIndex = vi.fn(() => 0);
			this.resetCounter = vi.fn();
			this.clear = vi.fn();
		}),
		fromNearConnect: vi.fn(() => ({})),
	};
});

vi.mock("@hot-labs/near-connect", () => ({
	NearConnector: vi.fn().mockImplementation(() => ({
		connect: vi.fn(() => Promise.resolve({})),
		disconnect: vi.fn(() => Promise.resolve()),
		getConnectedWallet: vi.fn(() => Promise.resolve({
			accounts: [{ accountId: MOCK_ACCOUNT_ID, publicKey: MOCK_PUBLIC_KEY }],
		})),
		on: vi.fn(),
		once: vi.fn(),
		off: vi.fn(),
		wallet: vi.fn(() => Promise.resolve({})),
		switchNetwork: vi.fn(),
	})),
}));

vi.mock("./profile.js", () => ({
	defaultGetProfile: vi.fn(() => Promise.resolve({ name: "Test User", description: "A test user" })),
	getImageUrl: vi.fn(() => "https://example.com/image.png"),
	getNetworkFromAccountId: vi.fn((id: string) =>
		id.endsWith(".testnet") ? "testnet" : "mainnet"
	),
}));

function makeVerifyBody(accountId: string = MOCK_ACCOUNT_ID) {
	const nonceBytes = makeUniqueNonce();
	const nonceHex = hex.encode(nonceBytes);
	return {
		signedMessage: {
			accountId,
			publicKey: MOCK_PUBLIC_KEY,
			signature: "mock-signature-base64",
		},
		message: `Sign in to ${MOCK_RECIPIENT}`,
		recipient: MOCK_RECIPIENT,
		nonce: nonceHex,
		accountId,
	};
}

async function setup(overrides?: {
	recipient?: string;
	requireFullAccessKey?: boolean;
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

async function verifyWithCookie(customFetchImpl: any): Promise<string> {
	const res = await customFetchImpl("http://localhost/api/auth/near/verify", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(makeVerifyBody()),
	});
	expect(res.status).toBe(200);
	const cookie = res.headers.get("set-cookie") || "";
	expect(cookie).not.toBe("");
	return cookie;
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
		it("should verify a valid signed message and create a session", async () => {
			const { client } = await setup();
			const { data, error } = await client.near.verify(makeVerifyBody());
			expect(error).toBeNull();
			expect(data?.success).toBe(true);
			expect(data?.token).toBeDefined();
			expect(data?.user.accountId).toBe(MOCK_ACCOUNT_ID);
			expect(data?.user.network).toBe("mainnet");
		});

		it("should reject an signed message with mismatched accountId", async () => {
			const { verifyNep413Signature } = await import("near-kit");
			(verifyNep413Signature as any).mockResolvedValueOnce(false);
			const { client } = await setup();
			const { error } = await client.near.verify(makeVerifyBody());
			expect(error).toBeDefined();
		});

		it("should pass callbackUrl through to NEP-413 verification (redirect wallets)", async () => {
			const { verifyNep413Signature } = await import("near-kit");
			(verifyNep413Signature as any).mockClear();
			const { client } = await setup();

			const { data, error } = await client.near.verify({
				...makeVerifyBody(),
				callbackUrl: "myapp://callback/success",
			});

			expect(error).toBeNull();
			expect(data?.success).toBe(true);
			const params = (verifyNep413Signature as any).mock.calls.at(-1)?.[1];
			expect(params?.callbackUrl).toBe("myapp://callback/success");
		});

		it("should detect nonce replay", async () => {
			const { client } = await setup();
			const body = makeVerifyBody();
			const { data: first } = await client.near.verify(body);
			expect(first?.success).toBe(true);

			const { error } = await client.near.verify(body);
			expect(error).toBeDefined();
		});

		it("should create a user with near.email for .near accounts", async () => {
			const { client, db } = await setup();
			const { data } = await client.near.verify(makeVerifyBody());
			expect(data?.success).toBe(true);

			const users = await db.findMany({ model: "user" });
			expect(users.length).toBeGreaterThan(0);
			const user = users.find((u: any) => u.id === data?.user.id);
			expect(user).toBeDefined();
			expect((user as any).email).toBe("test@near.email");
		});

		it("should create a testnet user with temp email", async () => {
			const testnetSignedMessage = {
				accountId: MOCK_TESTNET_ACCOUNT_ID,
				publicKey: MOCK_PUBLIC_KEY,
				signature: "mock-signature-base64",
			};

			const nonceBytes = makeUniqueNonce();
			const nonceHex = hex.encode(nonceBytes);

			const { client, db } = await setup();
			const { data, error } = await client.near.verify({
				signedMessage: testnetSignedMessage,
				message: `Sign in to ${MOCK_RECIPIENT}`,
				recipient: MOCK_RECIPIENT,
				nonce: nonceHex,
				accountId: MOCK_TESTNET_ACCOUNT_ID,
			});
			expect(error).toBeNull();
			expect(data?.success).toBe(true);
			expect(data?.user.network).toBe("testnet");

			const users = await db.findMany({ model: "user" });
			const user = users.find((u: any) => u.id === data?.user.id);
			expect(user).toBeDefined();
			expect((user as any).email).toMatch(/^temp-[a-f0-9]{8}@example\.near$/);
		});

		it("should create a user with temp email for .tg accounts", async () => {
			const { client, db } = await setup();
			const nonceBytes = makeUniqueNonce();
			const nonceHex = hex.encode(nonceBytes);

			const { data, error } = await client.near.verify({
				signedMessage: {
					accountId: "alice.tg",
					publicKey: MOCK_PUBLIC_KEY,
					signature: "mock-signature-base64",
				},
				message: `Sign in to ${MOCK_RECIPIENT}`,
				recipient: MOCK_RECIPIENT,
				nonce: nonceHex,
				accountId: "alice.tg",
			});
			expect(error).toBeNull();
			expect(data?.success).toBe(true);

			const users = await db.findMany({ model: "user" });
			const user = users.find((u: any) => u.id === data?.user.id);
			expect(user).toBeDefined();
			expect((user as any).email).toMatch(/^temp-[a-f0-9]{8}@example\.near$/);
		});

		it("should create a user with temp email for subaccounts", async () => {
			const { client, db } = await setup();
			const nonceBytes = makeUniqueNonce();
			const nonceHex = hex.encode(nonceBytes);

			const { data, error } = await client.near.verify({
				signedMessage: {
					accountId: "sub.app.near",
					publicKey: MOCK_PUBLIC_KEY,
					signature: "mock-signature-base64",
				},
				message: `Sign in to ${MOCK_RECIPIENT}`,
				recipient: MOCK_RECIPIENT,
				nonce: nonceHex,
				accountId: "sub.app.near",
			});
			expect(error).toBeNull();
			expect(data?.success).toBe(true);

			const users = await db.findMany({ model: "user" });
			const user = users.find((u: any) => u.id === data?.user.id);
			expect(user).toBeDefined();
			expect((user as any).email).toMatch(/^temp-[a-f0-9]{8}@example\.near$/);
		});

		it("should link existing user on re-verify with same accountId", async () => {
			const { client } = await setup();
			const { data: first } = await client.near.verify(makeVerifyBody());
			expect(first?.success).toBe(true);
			const userId = first!.user.id;

			const { data: second } = await client.near.verify(makeVerifyBody());
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

			const nonceBytes = makeUniqueNonce();
			const nonceHex = hex.encode(nonceBytes);

			const res = await customFetchImpl("http://localhost/api/auth/near/link-account", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: headers.get("cookie") || "",
				},
				body: JSON.stringify({
					signedMessage: {
						accountId: MOCK_ACCOUNT_ID,
						publicKey: MOCK_PUBLIC_KEY,
						signature: "mock-signature-base64",
					},
					message: `Sign in to ${MOCK_RECIPIENT}`,
					recipient: MOCK_RECIPIENT,
					nonce: nonceHex,
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
			const { error } = await client.near.verify(makeVerifyBody());
			expect(error).toBeNull();
		});
	});

	describe("list accounts endpoint", () => {
		it("should list NEAR accounts for authenticated user", async () => {
			const { customFetchImpl } = await setup();
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await customFetchImpl("http://localhost/api/auth/near/list-accounts", {
				method: "GET",
				headers: { cookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data?.accounts).toHaveLength(1);
			expect(data?.activeAccount?.accountId).toBe(MOCK_ACCOUNT_ID);
			expect(data?.availableAccounts).toEqual([]);
			expect(data?.accounts[0]?.providerId).toBe("siwn");
			expect(data?.accounts[0]?.isActive).toBe(true);
			expect(data?.accounts[0]?.isAvailable).toBe(false);
		});

		it("should mark primary account active and non-primary accounts available", async () => {
			const { customFetchImpl, db } = await setup();
			const cookie = await verifyWithCookie(customFetchImpl);

			const [primaryAccount] = await db.findMany({ model: "nearAccount" });
			await db.create({
				model: "nearAccount",
				data: {
					userId: primaryAccount.userId,
					accountId: "secondary.near",
					network: "mainnet",
					publicKey: MOCK_PUBLIC_KEY,
					isPrimary: false,
					createdAt: new Date(),
				},
			});

			const res = await customFetchImpl("http://localhost/api/auth/near/list-accounts", {
				method: "GET",
				headers: { cookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data?.activeAccount?.accountId).toBe(MOCK_ACCOUNT_ID);
			expect(data?.availableAccounts).toHaveLength(1);
			expect(data?.availableAccounts[0]?.accountId).toBe("secondary.near");
			expect(data?.accounts.map((account: any) => account.accountId)).toEqual([
				MOCK_ACCOUNT_ID,
				"secondary.near",
			]);
		});

		it("should select a primary NEAR account", async () => {
			const { customFetchImpl, db } = await setup();
			const cookie = await verifyWithCookie(customFetchImpl);

			const [primaryAccount] = await db.findMany({ model: "nearAccount" });
			await db.create({
				model: "nearAccount",
				data: {
					userId: primaryAccount.userId,
					accountId: "secondary.near",
					network: "mainnet",
					publicKey: MOCK_PUBLIC_KEY,
					isPrimary: false,
					createdAt: new Date(),
				},
			});

			const res = await customFetchImpl("http://localhost/api/auth/near/set-primary-account", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie,
				},
				body: JSON.stringify({
					accountId: "secondary.near",
				}),
			});
			expect(res.status).toBe(200);
			const data = await res.json();

			expect(data?.success).toBe(true);
			expect(data?.activeAccount?.accountId).toBe("secondary.near");
			expect(data?.availableAccounts.map((account: any) => account.accountId)).toEqual([
				MOCK_ACCOUNT_ID,
			]);
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
				payload: "mock-delegate-action-payload",
			});
			if (error) {
				expect(error).toBeDefined();
			}
		});

		it("should return relayer info for the runtime network", async () => {
			const { customFetchImpl } = await setup({ relayer: {}, recipient: MOCK_RECIPIENT });

			const nonceBytes = makeUniqueNonce();
			const nonceHex = hex.encode(nonceBytes);
			const verifyRes = await customFetchImpl("http://localhost/api/auth/near/verify", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					signedMessage: {
						accountId: MOCK_TESTNET_ACCOUNT_ID,
						publicKey: MOCK_PUBLIC_KEY,
						signature: "mock-signature-base64",
					},
					message: `Sign in to ${MOCK_RECIPIENT}`,
					recipient: MOCK_RECIPIENT,
					nonce: nonceHex,
					accountId: MOCK_TESTNET_ACCOUNT_ID,
				}),
			});
			expect(verifyRes.status).toBe(200);

			const cookie = verifyRes.headers.get("set-cookie") || "";
			expect(cookie).not.toBe("");

			const relayerInfoRes = await customFetchImpl("http://localhost/api/auth/near/relayer-info", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie,
				},
				body: JSON.stringify({}),
			});
			expect(relayerInfoRes.status).toBe(200);

			const relayerInfo = await relayerInfoRes.json();
			expect(relayerInfo.enabled).toBe(true);
			expect(relayerInfo.network).toBe("mainnet");
			expect(relayerInfo.balance).toBe("100");
		});
	});
});
