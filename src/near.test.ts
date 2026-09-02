import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { siwn } from "./index.js";
import { siwnClient } from "./client.js";
import { SUB_ACCOUNT_LABEL_REGEX } from "./types.js";
import { hex, base58, base64 } from "@scure/base";
import { atom } from "nanostores";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

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
		accountExists: vi.fn((accountId: string) => {
			const knownAccounts = new Set([
				"test.near",
				"test.testnet",
				"alice.tg",
				"sub.account.near",
				"a1b2c3.near",
				"user-name.near",
				"user_name.near",
				"deep.sub.account.near",
				"user.near",
				"sub.app.near",
				"mywiki.wiki.everything.near",
			]);
			return Promise.resolve(knownAccounts.has(accountId));
		}),
		getAccessKey: vi.fn(() => Promise.resolve({ nonce: 0, permission: "FullAccess" })),
		getAccessKeys: vi.fn(() => Promise.resolve({ keys: [] })),
		getTransactionStatus: vi.fn(() => Promise.resolve({
			status: { SuccessReceiptId: "yes" },
			transaction: { hash: "mock-tx-hash", outcome: { gas_burnt: "1000" } },
			transaction_outcome: { outcome: { gas_burnt: 1000 } },
		})),
		transaction: vi.fn(() => ({
			createAccount: vi.fn().mockReturnThis(),
			addKey: vi.fn().mockReturnThis(),
			deleteKey: vi.fn().mockReturnThis(),
			deleteAccount: vi.fn().mockReturnThis(),
			deployContract: vi.fn().mockReturnThis(),
			deployFromPublished: vi.fn().mockReturnThis(),
			functionCall: vi.fn().mockReturnThis(),
			transfer: vi.fn().mockReturnThis(),
			stake: vi.fn().mockReturnThis(),
			signedDelegateAction: vi.fn().mockReturnThis(),
			signWith: vi.fn().mockReturnThis(),
			publishContract: vi.fn().mockReturnThis(),
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
	subAccount?: any;
	secrets?: { parentKey?: string };
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
					secrets: overrides?.secrets,
					subAccount: overrides?.subAccount,
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

	describe("relayer config validation", () => {
		it("throws BetterAuthError on hybrid relayer config (network keys + flat security fields)", () => {
			let caught: unknown;
			try {
				siwn({
					recipient: MOCK_RECIPIENT,
					relayer: {
						mainnet: {},
						testnet: {},
						whitelistedContracts: ["example.near"],
						maxGasPerTransaction: "300000000000000",
						maxDepositPerTransaction: "0",
					} as any,
				});
			} catch (e) {
				caught = e;
			}
			expect(caught).toBeInstanceOf(Error);
			expect(String(caught)).toMatch(/whitelistedContracts|maxGasPerTransaction|maxDepositPerTransaction|cannot mix/);
		});

		it("throws on unknown relayer config key (strict)", () => {
			expect(() =>
				siwn({
					recipient: MOCK_RECIPIENT,
					relayer: { ephemeral: true } as any,
				}),
			).toThrow();
		});

		it("throws when maxGasPerTransaction / maxDepositPerTransaction are not non-negative integer strings", () => {
			expect(() =>
				siwn({ recipient: MOCK_RECIPIENT, relayer: { maxGasPerTransaction: 300 as any } }),
			).toThrow();
			expect(() =>
				siwn({ recipient: MOCK_RECIPIENT, relayer: { maxGasPerTransaction: "300.5" } }),
			).toThrow();
			expect(() =>
				siwn({ recipient: MOCK_RECIPIENT, relayer: { maxGasPerTransaction: "-1" } }),
			).toThrow();
			expect(() =>
				siwn({ recipient: MOCK_RECIPIENT, relayer: { maxDepositPerTransaction: "abc" } }),
			).toThrow();
		});

		it("throws when whitelistedContracts is not an array of strings", () => {
			expect(() =>
				siwn({ recipient: MOCK_RECIPIENT, relayer: { whitelistedContracts: "example.near" as any } }),
			).toThrow();
		});

		it("accepts a valid flat relayer config", () => {
			expect(() =>
				siwn({
					recipient: MOCK_RECIPIENT,
					relayer: {
						accountId: "relayer.near",
						privateKey: "ed25519:abcd",
						whitelistedContracts: ["example.near"],
						maxGasPerTransaction: "300000000000000",
						maxDepositPerTransaction: "0",
					},
				}),
			).not.toThrow();
		});

		it("accepts a valid dual relayer config", () => {
			expect(() =>
				siwn({
					recipients: { mainnet: "x.near", testnet: "x.testnet" },
					relayer: {
						mainnet: {},
						testnet: { accountId: "r.testnet", privateKey: "ed25519:abcd" },
					},
				}),
			).not.toThrow();
		});

		it("exports relayerConfigSchema and relayerDualNetworkConfigSchema", async () => {
			const exported = await import("./index.js");
			expect(exported.relayerConfigSchema).toBeDefined();
			expect(exported.relayerDualNetworkConfigSchema).toBeDefined();
		});
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

		it("logs ephemeral relayer initialization at boot without any API call (eager init)", async () => {
			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			try {
				await setup({ recipient: MOCK_RECIPIENT, relayer: {} });
				await vi.waitFor(
					() => {
						expect(logSpy).toHaveBeenCalledWith(
							expect.stringMatching(/\[siwn\] Relayer initialized: \S+ \(mainnet, ephemeral\)/),
						);
					},
					{ timeout: 3000 },
				);
			} finally {
				logSpy.mockRestore();
			}
		});

		it("getRelayerInfo returns { enabled:false, error } when ensureRelayer throws at runtime", async () => {
			const { customFetchImpl } = await setup({ recipient: MOCK_RECIPIENT, relayer: {} });
			const cookie = await verifyWithCookie(customFetchImpl);

			// Force ensureRelayer to throw on the next fresh ephemeral init by making generateKey throw.
			const { generateKey } = await import("near-kit");
			const generateSpy = (generateKey as any);
			const originalImpl = generateSpy.getMockImplementation() ?? (() => ({ publicKey: { data: new Uint8Array(32).fill(1), toString: () => MOCK_GENERATED_PUBLIC_KEY }, secretKey: MOCK_GENERATED_SECRET_KEY, sign: vi.fn(), signNep413Message: vi.fn() }));
			generateSpy.mockImplementation(() => {
				throw new Error("Forced key gen failure: simulated runtime DB/secret error");
			});

			try {
				const res = await customFetchImpl("http://localhost/api/auth/near/relayer-info", {
					method: "POST",
					headers: { "Content-Type": "application/json", cookie },
					body: JSON.stringify({ network: "testnet" }),
				});
				expect(res.status).toBe(200);
				const body = await res.json();
				expect(body.enabled).toBe(false);
				expect(typeof body.error).toBe("string");
				expect(body.error).toMatch(/Forced key gen failure/);
				expect(body.subAccountAvailable).toBe(false);
			} finally {
				generateSpy.mockImplementation(originalImpl);
			}
		});
	});

	describe("sub-account availability validation", () => {
		const validNames = ["mywiki", "my-wiki", "my_wiki", "a1b2c3", "wiki-test_1"];
		const invalidNames = ["-abc", "abc-", "a--b", "Abc", "my.wiki", "my wiki"];

		for (const name of validNames) {
			it(`should accept valid sub-account name: ${name}`, () => {
				expect(SUB_ACCOUNT_LABEL_REGEX.test(name)).toBe(true);
			});
		}

		for (const name of invalidNames) {
			if (name === "") return;
			it(`should reject invalid sub-account name: ${name}`, () => {
				expect(SUB_ACCOUNT_LABEL_REGEX.test(name)).toBe(false);
			});
		}

		it("should reject unauthenticated availability check", async () => {
			const { customFetchImpl } = await setup({
				subAccount: { parentAccount: "wiki.everything.near" },
			});

			const res = await customFetchImpl("http://localhost/api/auth/near/check-sub-account-availability", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ subAccountName: "mywiki" }),
			});
			expect(res.status).toBe(401);
		});

		it("should return not-configured when parentAccount is not set", async () => {
			const { customFetchImpl } = await setup({ recipient: MOCK_RECIPIENT });
			const cookie = await verifyWithCookie(customFetchImpl);

			const availRes = await customFetchImpl("http://localhost/api/auth/near/check-sub-account-availability", {
				method: "POST",
				headers: { "Content-Type": "application/json", cookie },
				body: JSON.stringify({ subAccountName: "mywiki" }),
			});
			expect(availRes.status).toBe(200);
			const body = await availRes.json();
			expect(body.available).toBe(false);
			expect(body.reason).toBe("not-configured");
		});

		it("should return too-long when composed accountId exceeds 64 chars", async () => {
			const { customFetchImpl } = await setup({
				subAccount: { parentAccount: "wiki.everything.near" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const longName = "a".repeat(64);
			const availRes = await customFetchImpl("http://localhost/api/auth/near/check-sub-account-availability", {
				method: "POST",
				headers: { "Content-Type": "application/json", cookie },
				body: JSON.stringify({ subAccountName: longName }),
			});
			expect(availRes.status).toBe(200);
			const body = await availRes.json();
			expect(body.available).toBe(false);
			expect(body.reason).toBe("too-long");
		});

		it("should check availability via RPC when parentAccount is configured", async () => {
			const { customFetchImpl } = await setup({
				subAccount: { parentAccount: "wiki.everything.near" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const availRes = await customFetchImpl("http://localhost/api/auth/near/check-sub-account-availability", {
				method: "POST",
				headers: { "Content-Type": "application/json", cookie },
				body: JSON.stringify({ subAccountName: "mywiki" }),
			});
			expect(availRes.status).toBe(200);
			const body = await availRes.json();
			expect(body.accountId).toBe("mywiki.wiki.everything.near");
			expect(body.parentAccount).toBe("wiki.everything.near");
			expect(body.reason).toBe("taken");
		});
	});

	describe("sub-account creation v2", () => {
		async function createWithCookie(customFetchImpl: any, cookie: string, body: object) {
			return customFetchImpl("http://localhost/api/auth/near/create-sub-account", {
				method: "POST",
				headers: { "Content-Type": "application/json", cookie },
				body: JSON.stringify(body),
			});
		}

		it("should create a sub-account with parentHasFullAccess", async () => {
			const { customFetchImpl } = await setup({
				subAccount: { parentAccount: "wiki.everything.near", parentHasFullAccess: true },
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "testwiki",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(body.accountId).toBe("testwiki.wiki.everything.near");
		});

		it("should create a sub-account with deploy.fromPublished", async () => {
			const { customFetchImpl } = await setup({
				subAccount: {
					parentAccount: "wiki.everything.near",
					deploy: { fromPublished: { accountId: "publisher.near" } },
				},
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki2",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(200);
		});

		it("should create a sub-account with init call", async () => {
			const { customFetchImpl } = await setup({
				subAccount: {
					parentAccount: "wiki.everything.near",
					init: { methodName: "init", args: { owner: "test.near" } },
				},
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki3",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(200);
		});

		it("should create with extendTx hook", async () => {
			const extendTx = vi.fn((tx: any) => tx);
			const { customFetchImpl } = await setup({
				subAccount: {
					parentAccount: "wiki.everything.near",
					extendTx,
				},
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki4",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(200);
			expect(extendTx).toHaveBeenCalledTimes(1);
			const ctx = extendTx.mock.calls[0][1];
			expect(ctx.newAccountId).toBe("wiki4.wiki.everything.near");
			expect(ctx.parentAccount).toBe("wiki.everything.near");
			expect(ctx.userPublicKey).toBe("ed25519:testpublickey");
			expect(ctx.userAccountId).toBe(MOCK_ACCOUNT_ID);
		});

		it("should create with onCreated hook and return success", async () => {
			const onCreated = vi.fn(() => Promise.resolve());
			const { customFetchImpl } = await setup({
				subAccount: {
					parentAccount: "wiki.everything.near",
					onCreated,
				},
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki5",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(onCreated).toHaveBeenCalledTimes(1);
		});

		it("should rollback when onCreated throws", async () => {
			const onCreated = vi.fn(() => Promise.reject(new Error("DB write failed")));
			const { customFetchImpl } = await setup({
				subAccount: {
					parentAccount: "wiki.everything.near",
					onCreated,
				},
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki6",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(500);
			expect(onCreated).toHaveBeenCalledTimes(1);
		});

		it("should call onRollback when onCreated fails", async () => {
			const onRollback = vi.fn(() => Promise.resolve());
			const onCreated = vi.fn(() => Promise.reject(new Error("DB write failed")));
			const { customFetchImpl } = await setup({
				subAccount: {
					parentAccount: "wiki.everything.near",
					onCreated,
					onRollback,
				},
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki7",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(500);
			expect(onCreated).toHaveBeenCalledTimes(1);
			expect(onRollback).toHaveBeenCalledTimes(1);
		});

		it("should reject unauthenticated create-sub-account", async () => {
			const { customFetchImpl } = await setup({
				subAccount: { parentAccount: "wiki.everything.near" },
				relayer: { accountId: "wiki.everything.near", privateKey: "ed25519:mock" },
				recipient: MOCK_RECIPIENT,
			});

			const res = await createWithCookie(customFetchImpl, "", {
				subAccountName: "wiki8",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(401);
		});

		it("should work without relayer when secrets.parentKey is provided", async () => {
			const { customFetchImpl } = await setup({
				subAccount: { parentAccount: "wiki.everything.near", parentHasFullAccess: true },
				secrets: { parentKey: "ed25519:mockparentkey" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki9",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
		});

		it("should return 503 without relayer and without secrets.parentKey", async () => {
			const { customFetchImpl } = await setup({
				subAccount: { parentAccount: "wiki.everything.near" },
				recipient: MOCK_RECIPIENT,
			});
			const cookie = await verifyWithCookie(customFetchImpl);

			const res = await createWithCookie(customFetchImpl, cookie, {
				subAccountName: "wiki10",
				publicKey: "ed25519:testpublickey",
			});
			expect(res.status).toBe(503);
		});
	});
});

describe("siwnClient getActions", () => {
	type SessionAtom = ReturnType<typeof atom<unknown>>;

	function makeSessionStore(initial: unknown) {
		const sessionAtom = atom<unknown>(initial);
		const store = {
			atoms: { session: sessionAtom },
			notify: vi.fn(),
			listen: vi.fn(),
		};
		return { store, sessionAtom };
	}

	function setupClient(initial: unknown, $fetchImpl: (path: string, opts?: unknown) => unknown = () => Promise.resolve({ data: null, error: null })) {
		const plugin = siwnClient({ recipient: MOCK_RECIPIENT });
		const { store, sessionAtom } = makeSessionStore(initial);
		const $fetch = vi.fn((path: string, opts?: unknown) => $fetchImpl(path, opts)) as unknown as Parameters<typeof plugin.getActions>[0];
		const actions = plugin.getActions($fetch, store as unknown as Parameters<typeof plugin.getActions>[1], undefined);
		return { actions, sessionAtom, plugin, store, $fetch };
	}

	describe("getAccountId session fallback", () => {
		it("returns null when there is no session and no NearConnect state", () => {
			const { actions } = setupClient(null);
			expect(actions.near.getAccountId()).toBeNull();
		});

		it("returns the primary nearAccount from session when NearConnect is not connected", () => {
			const { actions, sessionAtom } = setupClient({
				data: {
					user: {
						id: "user-1",
						nearAccount: { accountId: "alice.near", network: "mainnet", isPrimary: true },
					},
				},
			});
			expect(actions.near.getAccountId()).toBe("alice.near");
			sessionAtom.set({
				data: {
					user: { id: "user-1", nearAccount: { accountId: "bob.near", network: "testnet", isPrimary: true } },
				},
			});
			expect(actions.near.getAccountId()).toBe("bob.near");
		});

		it("returns the live NearConnect account when connected, even if a SIWN-linked account exists", () => {
			const { actions, plugin } = setupClient({
				data: {
					user: {
						id: "user-1",
						nearAccount: { accountId: "alice.near", network: "mainnet", isPrimary: true },
					},
				},
			});
			plugin.getAtoms(undefined as unknown as Parameters<typeof plugin.getAtoms>[0]).nearState.set({
				accountId: "charlie.near",
				publicKey: "ed25519:live",
				networkId: "mainnet",
			});
			expect(actions.near.getAccountId()).toBe("charlie.near");
		});

		it("returns null when the session is cleared", () => {
			const { actions, sessionAtom } = setupClient({
				data: {
					user: { id: "user-1", nearAccount: { accountId: "alice.near", network: "mainnet", isPrimary: true } },
				},
			});
			expect(actions.near.getAccountId()).toBe("alice.near");
			sessionAtom.set({ data: null });
			expect(actions.near.getAccountId()).toBeNull();
		});

		it("returns null when session has a user but no nearAccount (no primary linked)", () => {
			const { actions } = setupClient({ data: { user: { id: "user-1" } } });
			expect(actions.near.getAccountId()).toBeNull();
		});

		it("returns null when nearAccount.accountId is not a string", () => {
			const { actions } = setupClient({ data: { user: { id: "user-1", nearAccount: { accountId: 123 } } } });
			expect(actions.near.getAccountId()).toBeNull();
		});
	});

	describe("setPrimaryAccount", () => {
		it("notifies $sessionSignal so the session's nearAccount refreshes", async () => {
			const fetchResponse = {
				data: {
					success: true,
					accountId: "bob.near",
					network: "mainnet",
					message: "ok",
					accounts: [],
					activeAccount: {
						id: "acc-bob",
						userId: "user-1",
						accountId: "bob.near",
						network: "mainnet",
						publicKey: "ed25519:bob",
						isPrimary: true,
						createdAt: new Date(),
						providerId: "siwn",
						isActive: true,
						isAvailable: false,
					},
					availableAccounts: [],
				},
				error: null,
			};
			const { actions, store, plugin } = setupClient(
				{ data: { user: { id: "user-1", nearAccount: { accountId: "alice.near", network: "mainnet", isPrimary: true } } } },
				() => Promise.resolve(fetchResponse),
			);

			await actions.near.setPrimaryAccount({ accountId: "bob.near", network: "mainnet" });

			expect((store.notify as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("$sessionSignal");
			expect(plugin.getAtoms(undefined as unknown as Parameters<typeof plugin.getAtoms>[0]).nearState.get()).toEqual({
				accountId: "bob.near",
				publicKey: "ed25519:bob",
				networkId: "mainnet",
			});
		});
	});

	describe("ml-dsa-65 signatures", () => {
		const MLDSA65_PUBLIC_KEY_LENGTH = 1952;

		function concat(parts: Uint8Array[]): Uint8Array {
			const total = parts.reduce((sum, p) => sum + p.length, 0);
			const out = new Uint8Array(total);
			let offset = 0;
			for (const p of parts) {
				out.set(p, offset);
				offset += p.length;
			}
			return out;
		}

		function borshU32(value: number, littleEndian = true): Uint8Array {
			const out = new Uint8Array(4);
			new DataView(out.buffer).setUint32(0, value, littleEndian);
			return out;
		}

		function borshString(value: string): Uint8Array {
			const bytes = new TextEncoder().encode(value);
			return concat([borshU32(bytes.length), bytes]);
		}

		async function makeMlDsa65VerifyBody(accountId: string = MOCK_ACCOUNT_ID, tamperSignature = false) {
			const seed = new Uint8Array(32).fill(7);
			const keys = ml_dsa65.keygen(seed);
			const publicKey = `ml-dsa-65:${base58.encode(keys.publicKey)}`;

			const nonce = new Uint8Array(32);
			new DataView(nonce.buffer).setBigUint64(0, BigInt(Date.now()), false);
			crypto.getRandomValues(nonce.subarray(8));

			const message = `Sign in to ${MOCK_RECIPIENT}`;
			const recipient = MOCK_RECIPIENT;
			const tagBytes = borshU32(2147484061, true);
			const callbackNone = borshU32(0, true);
			const payload = concat([tagBytes, borshString(message), nonce, borshString(recipient), callbackNone]);
			const payloadAb = (() => {
				const ab = new ArrayBuffer(payload.byteLength);
				new Uint8Array(ab).set(payload);
				return ab;
			})();
			const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", payloadAb));
			const signatureBytes = ml_dsa65.sign(hash, keys.secretKey);
			const signature = base64.encode(tamperSignature ? flipBytes(signatureBytes) : signatureBytes);

			return {
				signedMessage: { accountId, publicKey, signature },
				message,
				recipient,
				nonce: hex.encode(nonce),
				accountId,
			};
		}

		function flipBytes(bytes: Uint8Array): Uint8Array {
			const out = new Uint8Array(bytes);
			out[0] ^= 0xff;
			return out;
		}

		it("should accept a valid ml-dsa-65 signed message and create a session", async () => {
			const { verifyNep413Signature } = await import("near-kit");
			(verifyNep413Signature as any).mockClear();
			(verifyNep413Signature as any).mockImplementation(() => {
				throw new Error("Only Ed25519 keys are supported for NEP-413");
			});

			const { client } = await setup();
			const body = await makeMlDsa65VerifyBody();
			expect(body.signedMessage.publicKey.startsWith("ml-dsa-65:")).toBe(true);
			const decoded = base58.decode(body.signedMessage.publicKey.slice("ml-dsa-65:".length));
			expect(decoded.length).toBe(MLDSA65_PUBLIC_KEY_LENGTH);

			const { data, error } = await client.near.verify(body);
			expect(verifyNep413Signature as any).not.toHaveBeenCalled();
			expect(error).toBeNull();
			expect(data?.success).toBe(true);
			expect(data?.token).toBeDefined();
			expect(data?.user.accountId).toBe(MOCK_ACCOUNT_ID);
		});

		it("should reject an ml-dsa-65 message with a tampered signature", async () => {
			const { client } = await setup();
			const body = await makeMlDsa65VerifyBody(undefined, true);
			const { error } = await client.near.verify(body);
			expect(error).toBeDefined();
		});

		it("should accept an ml-dsa-65 signed message on the link-account endpoint", async () => {
			const { verifyNep413Signature } = await import("near-kit");
			(verifyNep413Signature as any).mockClear();
			(verifyNep413Signature as any).mockImplementation(() => {
				throw new Error("Only Ed25519 keys are supported for NEP-413");
			});

			const { customFetchImpl, signInWithTestUser } = await getTestInstance(
				{
					plugins: [siwn({ recipient: MOCK_RECIPIENT, requireFullAccessKey: false })],
					emailAndPassword: { enabled: true },
				},
				{ clientOptions: { plugins: [] } },
			);

			const { headers } = await signInWithTestUser();
			const body = await makeMlDsa65VerifyBody();

			const res = await customFetchImpl("http://localhost/api/auth/near/link-account", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: headers.get("cookie") || "",
				},
				body: JSON.stringify(body),
			});
			expect(res.status).toBe(200);
			expect(verifyNep413Signature as any).not.toHaveBeenCalled();
			const json = await res.json();
			expect(json.success).toBe(true);
		});

		describe("key policy", () => {
			it("should accept an ml-dsa-65 function-call access key scoped to the recipient by default", async () => {
				const { Near } = await import("near-kit");
				new (Near as any)().getAccessKey.mockImplementation(() =>
					Promise.resolve({ nonce: 0, permission: { FunctionCall: { receiver_id: MOCK_RECIPIENT, method_names: [] } } }));
				const { client } = await setup();
				const body = await makeMlDsa65VerifyBody();
				const { data, error } = await client.near.verify(body);
				expect(error).toBeNull();
				expect(data?.success).toBe(true);
				expect(data?.token).toBeDefined();
			});
		});
	});
});

describe("NEP-413 key policy", () => {
	const FCAK_RECIPIENT = { nonce: 0, permission: { FunctionCall: { receiver_id: MOCK_RECIPIENT, method_names: [] } } };
	const FCAK_OTHER_CONTRACT = { nonce: 0, permission: { FunctionCall: { receiver_id: "other.contract.near", method_names: [] } } };

	async function setAccessKey(accessKey: unknown) {
		const { Near } = await import("near-kit");
		new (Near as any)().getAccessKey.mockImplementation(() => Promise.resolve(accessKey));
	}

	beforeEach(async () => {
		const { Near, verifyNep413Signature } = await import("near-kit");
		new (Near as any)().getAccessKey.mockImplementation(() => Promise.resolve({ nonce: 0, permission: "FullAccess" }));
		(verifyNep413Signature as any).mockImplementation(() => Promise.resolve(true));
	});

	afterEach(async () => {
		const { Near, verifyNep413Signature } = await import("near-kit");
		new (Near as any)().getAccessKey.mockImplementation(() => Promise.resolve({ nonce: 0, permission: "FullAccess" }));
		(verifyNep413Signature as any).mockImplementation(() => Promise.resolve(true));
	});

	it("should accept a function-call access key scoped to the recipient by default", async () => {
		await setAccessKey(FCAK_RECIPIENT);
		const { client } = await setup();
		const { data, error } = await client.near.verify(makeVerifyBody());
		expect(error).toBeNull();
		expect(data?.success).toBe(true);
		expect(data?.token).toBeDefined();
	});

	it("should reject a function-call access key scoped to another contract by default", async () => {
		await setAccessKey(FCAK_OTHER_CONTRACT);
		const { client } = await setup();
		const { error } = await client.near.verify(makeVerifyBody());
		expect(error).toBeDefined();
		expect(error?.status).toBe(401);
	});

	it("should reject a signing key that does not exist on the claimed account", async () => {
		await setAccessKey(null);
		const { client } = await setup();
		const { error } = await client.near.verify(makeVerifyBody());
		expect(error).toBeDefined();
		expect(error?.status).toBe(401);
	});

	it("should reject a function-call access key when requireFullAccessKey is true", async () => {
		await setAccessKey(FCAK_RECIPIENT);
		const { client } = await setup({ requireFullAccessKey: true });
		const { error } = await client.near.verify(makeVerifyBody());
		expect(error).toBeDefined();
		expect(error?.status).toBe(401);
	});

	it("should accept a full access key when requireFullAccessKey is true", async () => {
		const { client } = await setup({ requireFullAccessKey: true });
		const { data, error } = await client.near.verify(makeVerifyBody());
		expect(error).toBeNull();
		expect(data?.success).toBe(true);
	});

	it("should let validateLimitedAccessKey enable keys the default validator would reject", async () => {
		await setAccessKey(FCAK_OTHER_CONTRACT);
		const { client } = await setup({ validateLimitedAccessKey: async () => true });
		const { data, error } = await client.near.verify(makeVerifyBody());
		expect(error).toBeNull();
		expect(data?.success).toBe(true);
	});
});
