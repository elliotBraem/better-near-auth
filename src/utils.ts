import * as borsh from "borsh";
import { ed25519 } from "@noble/curves/ed25519.js";

export function bytesToBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

export function base64ToBytes(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

export interface EphemeralKeypair {
	accountId: string;
	privateKey: Uint8Array;
	publicKey: Uint8Array;
	publicKeyBase64: string;
}

export async function generateEphemeralKeypair(): Promise<EphemeralKeypair> {
	const privateKey = crypto.getRandomValues(new Uint8Array(32));
	const publicKey = ed25519.getPublicKey(privateKey);
	const accountId = bytesToHex(publicKey);
	return {
		accountId,
		privateKey,
		publicKey,
		publicKeyBase64: bytesToBase64(publicKey),
	};
}

export async function deriveAesKey(secret: string): Promise<CryptoKey> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HKDF" },
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: new TextEncoder().encode("better-near-auth-relayer"),
			info: new Uint8Array(0),
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

export async function encryptPrivateKey(
	privateKey: Uint8Array,
	secret: string,
): Promise<{ encrypted: string; iv: string }> {
	const aesKey = await deriveAesKey(secret);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		aesKey,
		privateKey as any,
	);
	return {
		encrypted: bytesToBase64(new Uint8Array(encrypted)),
		iv: bytesToBase64(iv),
	};
}

export async function decryptPrivateKey(
	encrypted: string,
	iv: string,
	secret: string,
): Promise<Uint8Array> {
	const aesKey = await deriveAesKey(secret);
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: base64ToBytes(iv) as any },
		aesKey,
		base64ToBytes(encrypted) as any,
	);
	return new Uint8Array(decrypted);
}

export interface PublicKeyStruct {
	keyType: number;
	data: Uint8Array;
}

export interface SignatureStruct {
	keyType: number;
	data: Uint8Array;
}

export interface DelegateActionStruct {
	senderId: string;
	receiverId: string;
	actions: any[];
	nonce: bigint;
	maxBlockHeight: bigint;
	publicKey: PublicKeyStruct;
}

export interface SignedDelegateStruct {
	delegateAction: DelegateActionStruct;
	signature: SignatureStruct;
}

export interface FunctionCallAction {
	type: "FunctionCall";
	methodName: string;
	args: Uint8Array;
	gas: bigint;
	deposit: bigint;
}

export interface TransferAction {
	type: "Transfer";
	deposit: bigint;
}

export type SimpleAction = FunctionCallAction | TransferAction;

export interface TransactionStruct {
	signerId: string;
	publicKey: PublicKeyStruct;
	nonce: bigint;
	receiverId: string;
	blockHash: Uint8Array;
	actions: any[];
}

export interface SignedTransactionStruct {
	transaction: TransactionStruct;
	signature: SignatureStruct;
}

const PublicKeySchema = { struct: { keyType: "u8", data: { array: { type: "u8" } } } };
const SignatureSchema = { struct: { keyType: "u8", data: { array: { type: "u8" } } } };

const DelegateActionBorshSchema: any = { struct: {
	senderId: "string",
	receiverId: "string",
	actions: { array: { type: "u8" } },
	nonce: "u64",
	maxBlockHeight: "u64",
	publicKey: PublicKeySchema,
} };

const SignedDelegateActionSchema = { struct: {
	delegateAction: DelegateActionBorshSchema,
	signature: SignatureSchema,
	publicKey: PublicKeySchema,
} };

const ActionSchema: any = {
	enum: [
		{ struct: { createAccount: { struct: {} } } },
		{ struct: { deployContract: { struct: { code: { array: { type: "u8" } } } } } },
		{ struct: { functionCall: { struct: { methodName: "string", args: { array: { type: "u8" } }, gas: "u64", deposit: "u128" } } } },
		{ struct: { transfer: { struct: { deposit: "u128" } } } },
		{ struct: { stake: { struct: { stake: "u128", publicKey: PublicKeySchema } } } },
		{ struct: { addKey: { struct: { publicKey: PublicKeySchema, accessKey: { struct: { nonce: "u64", permission: { enum: [
			{ struct: { functionCall: { struct: { allowance: "u128", receiverId: "string", methodNames: { array: { type: "string" } } } } } },
			{ struct: { fullAccess: { struct: {} } } },
		] } } } } } } },
		{ struct: { deleteKey: { struct: { publicKey: PublicKeySchema } } } },
		{ struct: { deleteAccount: { struct: { beneficiaryId: "string" } } } },
		SignedDelegateActionSchema,
	],
};

DelegateActionBorshSchema.struct.actions = { array: { type: ActionSchema } };

export const DelegateActionSerializationSchema = {
	struct: {
		senderId: "string",
		receiverId: "string",
		actions: { array: { type: ActionSchema } },
		nonce: "u64",
		maxBlockHeight: "u64",
		publicKey: PublicKeySchema,
	},
};

export const SignedDelegateBorshSchema = {
	struct: {
		delegateAction: DelegateActionSerializationSchema,
		signature: SignatureSchema,
	},
};

export const TransactionBorshSchema = {
	struct: {
		signerId: "string",
		publicKey: PublicKeySchema,
		nonce: "u64",
		receiverId: "string",
		blockHash: { array: { type: "u8", len: 32 } },
		actions: { array: { type: ActionSchema } },
	},
};

export const SignedTransactionBorshSchema = {
	struct: {
		transaction: TransactionBorshSchema,
		signature: SignatureSchema,
	},
};

export function serializeDelegateAction(action: DelegateActionStruct): Uint8Array {
	return borsh.serialize(DelegateActionSerializationSchema, action, false);
}

export function serializeSignedDelegateAction(signedDelegate: SignedDelegateStruct): Uint8Array {
	return borsh.serialize(SignedDelegateBorshSchema, signedDelegate, false);
}

export function deserializeSignedDelegateAction(base64: string): SignedDelegateStruct {
	const bytes = base64ToBytes(base64);
	return borsh.deserialize(SignedDelegateBorshSchema, bytes, false) as unknown as SignedDelegateStruct;
}

export function serializeTransaction(tx: TransactionStruct): Uint8Array {
	return borsh.serialize(TransactionBorshSchema, tx, false);
}

export function serializeSignedTransaction(stx: SignedTransactionStruct): Uint8Array {
	return borsh.serialize(SignedTransactionBorshSchema, stx, false);
}

export async function signTransaction(
	txBytes: Uint8Array,
	privateKey: Uint8Array,
): Promise<SignatureStruct> {
	const sig = ed25519.sign(txBytes, privateKey);
	return { keyType: 0, data: sig };
}

export function parsePublicKey(pkString: string): PublicKeyStruct {
	if (pkString.startsWith("ed25519:")) {
		const data = base64ToBytes(pkString.slice(8));
		return { keyType: 0, data };
	}
	const data = base64ToBytes(pkString);
	return { keyType: 0, data };
}

export function publicKeyToString(pk: PublicKeyStruct): string {
	return `ed25519:${bytesToBase64(pk.data)}`;
}
