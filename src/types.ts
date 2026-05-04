import { z } from "zod";
import { AccountIdSchema } from "near-kit/schemas";
import type { AccountId, GasInput, AmountInput, AccountState } from "near-kit";

export type { AccountId };

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

const signedMessageSchema = z.object({
	accountId: z.string(),
	publicKey: z.string(),
	signature: z.string(),
	state: z.string().optional(),
});

export const LinkAccountRequest = z.object({
	signedMessage: signedMessageSchema,
	message: z.string(),
	recipient: z.string(),
	nonce: z.string(),
	accountId: AccountIdSchema,
});

export const NonceRequest = z.object({
	accountId: AccountIdSchema,
	networkId: z.union([z.literal("mainnet"), z.literal("testnet")])
});

export const VerifyRequest = z.object({
	signedMessage: signedMessageSchema,
	message: z.string(),
	recipient: z.string(),
	nonce: z.string(),
	accountId: AccountIdSchema,
});

export interface NearFunctionCallAction {
	type: "FunctionCall";
	methodName: string;
	args: Record<string, unknown>;
	gas: GasInput;
	deposit: AmountInput;
}

export interface NearTransferAction {
	type: "Transfer";
	deposit: AmountInput;
}

export type NearActionInput = NearFunctionCallAction | NearTransferAction;

export const RelayRequest = z.object({
	payload: z.string(),
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

export const ViewContractRequest = z.object({
	contractId: z.string(),
	methodName: z.string(),
	args: z.record(z.string(), z.any()).optional(),
});
export type ViewContractRequestT = z.infer<typeof ViewContractRequest>;

export const NonceResponse = z.object({ nonce: z.string() });
export const VerifyResponse = z.object({
	token: z.string(),
	success: z.literal(true),
	user: z.object({
		id: z.string(),
		accountId: AccountIdSchema,
		network: z.union([z.literal("mainnet"), z.literal("testnet")]),
	}),
});
export const ProfileResponse = profileSchema.nullable();
export const ViewContractResponse = z.object({ result: z.unknown() });

export const ProfileRequest = z.object({
	accountId: AccountIdSchema.optional(),
});
export type ProfileRequestT = z.infer<typeof ProfileRequest>;

export type NonceRequestT = z.infer<typeof NonceRequest>;
export type NonceResponseT = z.infer<typeof NonceResponse>;
export type VerifyRequestT = z.infer<typeof VerifyRequest>;
export type VerifyResponseT = z.infer<typeof VerifyResponse>;
export type ProfileResponseT = z.infer<typeof ProfileResponse>;
export type ViewContractResponseT = z.infer<typeof ViewContractResponse>;

export interface RelayedTransactionRecord {
	id: string;
	userId: string;
	txHash: string;
	senderId: string;
	receiverId: string;
	network: "mainnet" | "testnet";
	status: string;
	gasUsed?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface RelayerInfo extends AccountState {
	accountId: string;
	mode: "ephemeral" | "explicit";
	network: "mainnet" | "testnet";
	hasKey: boolean;
	createdAt?: Date;
	lastUsedAt?: Date;
}
