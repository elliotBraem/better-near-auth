import { z } from "zod";
import { AccountIdSchema, type AccountId } from "near-kit/schemas";
import type { AccountState } from "near-kit";

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

export interface ListedNearAccount extends NearAccount {
	providerId: "siwn";
	isActive: boolean;
	isAvailable: boolean;
}

export interface ListAccountsResponseT {
	accounts: ListedNearAccount[];
	activeAccount: ListedNearAccount | null;
	availableAccounts: ListedNearAccount[];
}

export interface SetPrimaryAccountResponseT extends ListAccountsResponseT {
	success: boolean;
	accountId: string;
	network: "mainnet" | "testnet";
	message: string;
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
	callbackUrl: z.string().optional(),
});

export const SetPrimaryAccountRequest = z.object({
	accountId: AccountIdSchema,
	network: z.enum(["mainnet", "testnet"]).optional(),
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
	callbackUrl: z.string().optional(),
});

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
export type SetPrimaryAccountRequestT = z.infer<typeof SetPrimaryAccountRequest>;
export type VerifyRequestT = z.infer<typeof VerifyRequest>;
export type VerifyResponseT = z.infer<typeof VerifyResponse>;
export type ProfileResponseT = z.infer<typeof ProfileResponse>;
export type ViewContractResponseT = z.infer<typeof ViewContractResponse>;

export const RelayedTransactionSchema = z.object({
	id: z.string(),
	userId: z.string(),
	txHash: z.string(),
	senderId: z.string(),
	receiverId: z.string(),
	network: z.string(),
	status: z.string(),
	gasUsed: z.string().optional(),
	createdAt: z.string(),
	updatedAt: z.string().optional(),
});
export type RelayedTransactionT = z.infer<typeof RelayedTransactionSchema>;

export const RelayHistoryResponse = z.object({
	transactions: z.array(RelayedTransactionSchema),
});
export type RelayHistoryResponseT = z.infer<typeof RelayHistoryResponse>;

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
	publicKey: string;
	hasKey: boolean;
	createdAt?: Date;
	lastUsedAt?: Date;
	parentAccount?: string;
	subAccountAvailable?: boolean;
}

export interface DualNetworkConfig<T> {
	mainnet: T;
	testnet: T;
}

export const GetRelayerInfoRequest = z.object({
	network: z.enum(["mainnet", "testnet"]).optional(),
});
export type GetRelayerInfoRequestT = z.infer<typeof GetRelayerInfoRequest>;

export interface SubAccountRelayerFCAKConfig {
	receiverId: string;
	methodNames?: string[];
	allowance?: string;
}

export interface SubAccountConfig {
	parentAccount?: string;
	parentKey?: string;
	minDeposit?: string;
	addRelayerFCAK?: boolean;
	relayerFCAK?: SubAccountRelayerFCAKConfig;
}

export const CreateSubAccountRequest = z.object({
	subAccountName: z.string().regex(/^[a-z0-9]+$/, "Must be lowercase alphanumeric characters only"),
	network: z.enum(["mainnet", "testnet"]).optional(),
	publicKey: z.string(),
});
export type CreateSubAccountRequestT = z.infer<typeof CreateSubAccountRequest>;

export const CreateSubAccountResponse = z.object({
	success: z.literal(true),
	accountId: z.string(),
	network: z.enum(["mainnet", "testnet"]),
	publicKey: z.string(),
	message: z.string(),
});
export type CreateSubAccountResponseT = z.infer<typeof CreateSubAccountResponse>;

export const CheckSubAccountAvailabilityRequest = z.object({
	subAccountName: z.string().regex(/^[a-z0-9]+$/),
	network: z.enum(["mainnet", "testnet"]).optional(),
});
export type CheckSubAccountAvailabilityRequestT = z.infer<typeof CheckSubAccountAvailabilityRequest>;

export const CheckSubAccountAvailabilityResponse = z.object({
	available: z.boolean(),
	accountId: z.string(),
});
export type CheckSubAccountAvailabilityResponseT = z.infer<typeof CheckSubAccountAvailabilityResponse>;
