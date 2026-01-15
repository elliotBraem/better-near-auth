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


export const NonceRequest = z.object({
	accountId: accountIdSchema,
	publicKey: z.string().optional(),
	networkId: z.union([z.literal("mainnet"), z.literal("testnet")])
});
export const VerifyRequest = z.object({
	authToken: z.string().min(1),
	accountId: accountIdSchema,
	email: z.email().optional(),
});
export const ProfileRequest = z.object({
	accountId: accountIdSchema.optional(),
});

export const NonceResponse = z.object({ nonce: z.string() }); // Base64 string
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
