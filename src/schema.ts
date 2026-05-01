import type { BetterAuthPluginDBSchema } from "better-auth/db";

export const schema = {
	nearAccount: {
		fields: {
			userId: {
				type: "string",
				references: {
					model: "user",
					field: "id",
				},
				required: true,
			},
			accountId: {
				type: "string",
				required: true,
			},
			network: {
				type: "string",
				required: true,
			},
			publicKey: {
				type: "string",
				required: true,
			},
			isPrimary: {
				type: "boolean",
				defaultValue: false,
			},
			createdAt: {
				type: "date",
				required: true,
			},
		},
	},
	relayedTransaction: {
		fields: {
			userId: {
				type: "string",
				references: {
					model: "user",
					field: "id",
				},
			},
			txHash: {
				type: "string",
				required: true,
			},
			senderId: {
				type: "string",
				required: true,
			},
			receiverId: {
				type: "string",
				required: true,
			},
			network: {
				type: "string",
				required: true,
			},
			status: {
				type: "string",
				required: true,
			},
			gasUsed: {
				type: "string",
			},
			createdAt: {
				type: "date",
				required: true,
			},
			updatedAt: {
				type: "date",
			},
		},
	},
	relayerKey: {
		fields: {
			accountId: {
				type: "string",
				required: true,
			},
			encryptedPrivateKey: {
				type: "string",
				required: true,
			},
			iv: {
				type: "string",
				required: true,
			},
			publicKey: {
				type: "string",
				required: true,
			},
			network: {
				type: "string",
				required: true,
			},
			createdAt: {
				type: "date",
				required: true,
			},
			lastUsedAt: {
				type: "date",
			},
		},
	},
} satisfies BetterAuthPluginDBSchema;
