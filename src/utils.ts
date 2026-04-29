import { serialize, deserialize } from "@fastnear/borsh";
import { nearChainSchema } from "@fastnear/borsh-schema";
import { ed25519 } from "@noble/curves/ed25519.js";

export { serialize, deserialize, nearChainSchema };

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

export function serializeSignedDelegateAction(signedDelegate: any): Uint8Array {
	return serialize(nearChainSchema.SignedDelegate, signedDelegate);
}

export function deserializeSignedDelegateAction(base64Str: string): any {
	const bytes = base64ToBytes(base64Str);
	return deserialize(nearChainSchema.SignedDelegate, bytes);
}

export function serializeTransaction(tx: any): Uint8Array {
	return serialize(nearChainSchema.Transaction, tx);
}

export function serializeSignedTransaction(stx: any): Uint8Array {
	return serialize(nearChainSchema.SignedTransaction, stx);
}

export function signTransaction(
	txBytes: Uint8Array,
	privateKey: Uint8Array,
): any {
	const sig = ed25519.sign(txBytes, privateKey);
	return { ed25519Signature: { data: sig } };
}

export function makeEd25519PublicKey(data: Uint8Array): any {
	return { ed25519Key: { data } };
}

export function parsePublicKey(pkString: string): any {
	if (pkString.startsWith("ed25519:")) {
		return makeEd25519PublicKey(base64ToBytes(pkString.slice(8)));
	}
	return makeEd25519PublicKey(base64ToBytes(pkString));
}

export function publicKeyToString(pk: any): string {
	const data = pk.ed25519Key?.data ?? pk.secp256k1Key?.data;
	return `ed25519:${bytesToBase64(data)}`;
}
