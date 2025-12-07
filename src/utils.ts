/**
 * Utility functions for base64 encoding/decoding
 * Replaces fastintear/utils functions (now using standard browser APIs)
 */

export function bytesToBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

export function base64ToBytes(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

