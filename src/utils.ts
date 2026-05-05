export function bytesToBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
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

async function deriveAesKey(secret: string): Promise<CryptoKey> {
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
		privateKey as Uint8Array<ArrayBuffer>,
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
		{ name: "AES-GCM", iv: base64ToBytes(iv) as Uint8Array<ArrayBuffer> },
		aesKey,
		base64ToBytes(encrypted) as Uint8Array<ArrayBuffer>,
	);
	return new Uint8Array(decrypted);
}
