import { z } from "zod";

export const accountIdSchema = z.string()
	.min(2)
	.max(64)
	.regex(/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/, "Invalid NEAR account ID format");

export type AccountId = z.infer<typeof accountIdSchema>;

export interface NearAccount {
	id: string;
	userId: string;
	accountId: string;
	network: "mainnet" | "testnet";
	publicKey: string;
	isPrimary: boolean;
	createdAt: Date;
}

export const socialImageSchema = z.object({
	url: z.string().optional(),
	ipfs_cid: z.string().optional(),
});

export const profileSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	image: socialImageSchema.optional(),
	backgroundImage: socialImageSchema.optional(),
	linktree: z.record(z.string(), z.string()).optional(),
});

export type SocialImage = z.infer<typeof socialImageSchema>;
export type Profile = z.infer<typeof profileSchema>;

export const LinkAccountRequest = z.object({
	authToken: z.string().min(1),
	accountId: accountIdSchema,
});

export const NonceRequest = z.object({
	accountId: accountIdSchema,
	networkId: z.union([z.literal("mainnet"), z.literal("testnet")])
});

export const VerifyRequest = z.object({
	authToken: z.string().min(1),
	accountId: accountIdSchema,
	email: z.string().email().optional(),
});

export const NearFunctionCallActionSchema = z.object({
	type: z.literal("FunctionCall"),
	methodName: z.string(),
	args: z.record(z.string(), z.any()),
	gas: z.string(),
	deposit: z.string(),
});

export const NearTransferActionSchema = z.object({
	type: z.literal("Transfer"),
	deposit: z.string(),
});

export const NearActionSchema = z.union([NearFunctionCallActionSchema, NearTransferActionSchema]);
export type NearActionInput = z.infer<typeof NearActionSchema>;

export const BuildDelegateActionRequest = z.object({
	receiverId: z.string(),
	actions: z.array(NearActionSchema),
});
export type BuildDelegateActionRequestT = z.infer<typeof BuildDelegateActionRequest>;

export const RelayRequest = z.object({
	signedDelegateAction: z.string(),
});
export type RelayRequestT = z.infer<typeof RelayRequest>;

export const RelayResponse = z.object({
	txHash: z.string(),
	status: z.enum(["pending", "completed", "failed"]),
});
export type RelayResponseT = z.infer<typeof RelayResponse>;

export const RelayStatusResponse = z.object({
	status: z.enum(["pending", "completed", "failed"]),
	gasUsed: z.string().optional(),
	outcome: z.unknown().optional(),
});
export type RelayStatusResponseT = z.infer<typeof RelayStatusResponse>;

export const ProfileRequest = z.object({
	accountId: accountIdSchema.optional(),
});

export const NonceResponse = z.object({ nonce: z.string() });
export const VerifyResponse = z.object({
	token: z.string(),
	success: z.literal(true),
	user: z.object({
		id: z.string(),
		accountId: accountIdSchema,
		network: z.union([z.literal("mainnet"), z.literal("testnet")]),
	}),
});
export const ProfileResponse = profileSchema.nullable();

export type NonceRequestT = z.infer<typeof NonceRequest>;
export type NonceResponseT = z.infer<typeof NonceResponse>;
export type VerifyRequestT = z.infer<typeof VerifyRequest>;
export type VerifyResponseT = z.infer<typeof VerifyResponse>;
export type ProfileRequestT = z.infer<typeof ProfileRequest>;
export type ProfileResponseT = z.infer<typeof ProfileResponse>;

export interface BetterAuthSession {
	user: {
		id: string;
		name: string;
		email: string;
		image?: string;
		nearAccount?: NearAccount;
	};
	session: {
		token: string;
		expiresAt: Date;
	};
}

export interface SessionResponse {
	data: BetterAuthSession | null;
	error?: {
		message: string;
		code?: string;
	};
}

export interface RelayerInfo {
	accountId: string;
	mode: "ephemeral" | "explicit";
	network: "mainnet" | "testnet";
	balance: string;
	hasKey: boolean;
	createdAt?: Date;
	lastUsedAt?: Date;
}
