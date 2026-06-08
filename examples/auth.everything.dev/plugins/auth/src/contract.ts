import type { InferContractRouterInputs, InferContractRouterOutputs } from "@orpc/contract";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const Errors = {
  UNAUTHORIZED: {
    status: 401,
    message: "Authentication required",
  },
  FORBIDDEN: {
    status: 403,
    message: "Insufficient permissions",
  },
  NOT_FOUND: {
    status: 404,
    message: "Resource not found",
  },
  BAD_REQUEST: {
    status: 400,
    message: "Invalid request",
  },
};

const nearIdentitySchema = z.object({
  accountId: z.string(),
  network: z.string(),
  publicKey: z.string(),
  isPrimary: z.boolean(),
});

const nearCapabilitiesSchema = z.object({
  primaryAccountId: z.string().nullable(),
  linkedAccounts: z.array(nearIdentitySchema),
  hasNearAccount: z.boolean(),
});

const organizationMemberSchema = z.object({
  id: z.string(),
  role: z.string(),
});

const organizationInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const organizationContextSchema = z.object({
  activeOrganizationId: z.string().nullable(),
  organization: organizationInfoSchema.nullable(),
  member: organizationMemberSchema.nullable(),
  isPersonal: z.boolean(),
  hasOrganization: z.boolean(),
});

const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  isAnonymous: z.boolean().nullable(),
});

const sessionDataSchema = z.object({
  session: z
    .object({
      id: z.string(),
      token: z.string(),
      userId: z.string(),
      expiresAt: z.date(),
      activeOrganizationId: z.string().nullable(),
    })
    .nullable(),
  user: sessionUserSchema.nullable(),
});

const userPrincipalSchema = z.object({
  type: z.literal("user"),
  userId: z.string(),
  user: sessionUserSchema,
});

const organizationPrincipalSchema = z.object({
  type: z.literal("organization"),
  organizationId: z.string(),
});

const anonymousPrincipalSchema = z.object({
  type: z.literal("anonymous"),
  userId: z.string(),
  user: sessionUserSchema.nullable(),
});

const principalSchema = z.union([
  userPrincipalSchema,
  organizationPrincipalSchema,
  anonymousPrincipalSchema,
]);

const apiKeyContextSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  permissions: z.record(z.string(), z.array(z.string())).nullable(),
});

const requestContextSchema = z.object({
  user: sessionUserSchema.nullable(),
  userId: z.string().nullable(),
  isAuthenticated: z.boolean(),
  authMethod: z.enum(["session", "apiKey", "anonymous", "none"]),
  principal: principalSchema.nullable(),
  apiKey: apiKeyContextSchema.nullable(),
  near: nearCapabilitiesSchema,
  organization: organizationContextSchema,
  organizations: z
    .array(
      z.object({
        id: z.string(),
        role: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
      }),
    )
    .optional(),
});

export const apiKeySchema = z.object({
  id: z.string(),
  configId: z.string(),
  referenceId: z.string(),
  name: z.string().nullable(),
  prefix: z.string().nullable(),
  start: z.string().nullable(),
  enabled: z.boolean(),
  rateLimitEnabled: z.boolean(),
  rateLimitMax: z.number().nullable(),
  rateLimitTimeWindow: z.number().nullable(),
  remaining: z.number().nullable(),
  requestCount: z.number(),
  lastRequest: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.unknown().nullable(),
  permissions: z.record(z.string(), z.array(z.string())).nullable(),
});

const apiKeyRateLimitSchema = z.object({
  enabled: z.boolean().optional(),
  timeWindow: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
});

const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: z.string(),
  createdAt: z.date(),
});

const memberWithUserSchema = memberSchema.extend({
  user: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
      image: z.string().nullable(),
    })
    .nullable(),
});

const invitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  expiresAt: z.date(),
  inviterId: z.string(),
});

// ── NEAR SIWN Schemas ────────────────────────────────────────────────

const signedMessageSchema = z.object({
  accountId: z.string(),
  publicKey: z.string(),
  signature: z.string(),
  state: z.string().optional(),
});

const nearAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  accountId: z.string(),
  network: z.string(),
  publicKey: z.string(),
  providerId: z.literal("siwn").optional(),
  isPrimary: z.boolean(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  createdAt: z.date(),
});

const socialImageSchema = z.object({
  url: z.string().optional(),
  ipfs_cid: z.string().optional(),
});

const profileOutputSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    image: socialImageSchema.optional(),
    backgroundImage: socialImageSchema.optional(),
    linktree: z.record(z.string(), z.string()).optional(),
  })
  .nullable();

const relayedTransactionSchema = z.object({
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

const relayerInfoOutputSchema = z.object({
  enabled: z.boolean(),
  accountId: z.string().optional(),
  mode: z.enum(["ephemeral", "explicit"]).optional(),
  network: z.enum(["mainnet", "testnet"]).optional(),
  balance: z.string().optional(),
  available: z.string().optional(),
  staked: z.string().optional(),
  storageUsage: z.string().optional(),
  storageBytes: z.number().optional(),
  hasContract: z.boolean().optional(),
  hasKey: z.boolean().optional(),
  publicKey: z.string().optional(),
  createdAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
});

export const contract = oc.router({
  health: oc
    .route({ method: "GET", path: "/v1/auth/health" })
    .output(z.object({ status: z.literal("ok"), timestamp: z.string() })),

  getSession: oc
    .route({ method: "GET", path: "/v1/auth/session" })
    .output(sessionDataSchema)
    .errors(Errors),

  getContext: oc
    .route({ method: "GET", path: "/v1/auth/context" })
    .output(requestContextSchema)
    .errors(Errors),

  getActiveMember: oc
    .route({ method: "GET", path: "/v1/auth/active-member" })
    .input(
      z.object({
        organizationId: z.string().optional(),
      }),
    )
    .output(
      z.object({
        id: z.string().nullable(),
        role: z.string().nullable(),
        organizationId: z.string().nullable(),
      }),
    )
    .errors(Errors),

  // ── Organization ─────────────────────────────────────────────────────

  listOrganizations: oc
    .route({ method: "GET", path: "/v1/auth/organizations" })
    .output(
      z.array(
        organizationInfoSchema.extend({
          createdAt: z.date(),
          role: z.string(),
        }),
      ),
    )
    .errors(Errors),

  createOrganization: oc
    .route({ method: "POST", path: "/v1/auth/organizations" })
    .input(
      z.object({
        name: z.string(),
        slug: z.string(),
        logo: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .output(organizationInfoSchema.extend({ createdAt: z.date() }))
    .errors(Errors),

  setActiveOrganization: oc
    .route({ method: "POST", path: "/v1/auth/organizations/set-active" })
    .input(z.object({ organizationId: z.string().nullable() }))
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  leaveOrganization: oc
    .route({ method: "POST", path: "/v1/auth/organizations/{id}/leave" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  getOrganization: oc
    .route({ method: "GET", path: "/v1/auth/organizations/{id}" })
    .input(z.object({ id: z.string() }))
    .output(
      z
        .object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          logo: z.string().nullable().optional(),
          metadata: z.unknown().nullable(),
          createdAt: z.date(),
        })
        .nullable(),
    )
    .errors(Errors),

  updateOrganization: oc
    .route({ method: "PATCH", path: "/v1/auth/organizations/{id}" })
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        logo: z.string().nullable().optional(),
        metadata: z.unknown().optional(),
      }),
    )
    .output(organizationInfoSchema)
    .errors(Errors),

  deleteOrganization: oc
    .route({ method: "DELETE", path: "/v1/auth/organizations/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  // ── Members ──────────────────────────────────────────────────────────

  listMembers: oc
    .route({ method: "GET", path: "/v1/auth/members" })
    .input(
      z.object({
        organizationId: z.string(),
      }),
    )
    .output(z.array(memberWithUserSchema))
    .errors(Errors),

  removeMember: oc
    .route({ method: "DELETE", path: "/v1/auth/members/{id}" })
    .input(
      z.object({
        id: z.string(),
        organizationId: z.string(),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  updateMemberRole: oc
    .route({ method: "PATCH", path: "/v1/auth/members/{id}/role" })
    .input(
      z.object({
        id: z.string(),
        organizationId: z.string(),
        role: z.enum(["owner", "admin", "member"]),
      }),
    )
    .output(memberWithUserSchema)
    .errors(Errors),

  // ── Invitations ──────────────────────────────────────────────────────

  inviteMember: oc
    .route({ method: "POST", path: "/v1/auth/invitations" })
    .input(
      z.object({
        email: z.string(),
        role: z.enum(["owner", "admin", "member"]),
        organizationId: z.string().optional(),
        resend: z.boolean().optional(),
      }),
    )
    .output(invitationSchema)
    .errors(Errors),

  getInvitation: oc
    .route({ method: "GET", path: "/v1/auth/invitations/{id}" })
    .input(z.object({ id: z.string() }))
    .output(
      invitationSchema
        .extend({
          organization: organizationInfoSchema.nullable(),
        })
        .nullable(),
    )
    .errors(Errors),

  listInvitations: oc
    .route({ method: "GET", path: "/v1/auth/invitations" })
    .input(
      z.object({
        organizationId: z.string(),
      }),
    )
    .output(z.array(invitationSchema))
    .errors(Errors),

  cancelInvitation: oc
    .route({ method: "DELETE", path: "/v1/auth/invitations/{id}" })
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  resendInvitation: oc
    .route({ method: "POST", path: "/v1/auth/invitations/{id}/resend" })
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .output(z.object({ sent: z.boolean() }))
    .errors(Errors),

  acceptInvitation: oc
    .route({ method: "POST", path: "/v1/auth/invitations/{id}/accept" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  rejectInvitation: oc
    .route({ method: "POST", path: "/v1/auth/invitations/{id}/reject" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  // ── API Keys ───────────────────────────────────────────────────────

  listApiKeys: oc
    .route({ method: "GET", path: "/v1/auth/api-keys" })
    .input(
      z.object({
        organizationId: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
        sortBy: z.enum(["createdAt", "name", "expiresAt", "lastRequest"]).optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
      }),
    )
    .output(z.array(apiKeySchema))
    .errors(Errors),

  createApiKey: oc
    .route({ method: "POST", path: "/v1/auth/api-keys" })
    .input(
      z.object({
        name: z.string().optional(),
        prefix: z.string().optional(),
        expiresIn: z.number().int().positive().optional(),
        permissions: z.record(z.string(), z.array(z.string())).optional(),
        metadata: z.unknown().optional(),
        rateLimit: apiKeyRateLimitSchema.optional(),
        organizationId: z.string().optional(),
        configId: z.string().optional(),
      }),
    )
    .output(apiKeySchema.extend({ key: z.string() }))
    .errors(Errors),

  updateApiKey: oc
    .route({ method: "PATCH", path: "/v1/auth/api-keys/{id}" })
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        permissions: z.record(z.string(), z.array(z.string())).nullable().optional(),
        metadata: z.unknown().optional(),
        expiresIn: z.number().int().positive().nullable().optional(),
        rateLimit: apiKeyRateLimitSchema.optional(),
      }),
    )
    .output(apiKeySchema)
    .errors(Errors),

  deleteApiKey: oc
    .route({ method: "DELETE", path: "/v1/auth/api-keys/{id}" })
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .errors(Errors),

  verifyApiKey: oc
    .route({ method: "POST", path: "/v1/auth/api-keys/verify" })
    .input(
      z.object({
        key: z.string(),
        configId: z.string().optional(),
        permissions: z.record(z.string(), z.array(z.string())).optional(),
      }),
    )
    .output(
      z.object({
        valid: z.boolean(),
        error: z
          .object({
            code: z.string(),
            message: z.string().optional(),
          })
          .nullable(),
        key: apiKeySchema.nullable(),
      }),
    )
    .errors(Errors),

  // ── NEAR SIWN ──────────────────────────────────────────────────────

  nearNonce: oc
    .route({ method: "POST", path: "/v1/near/nonce" })
    .input(
      z.object({
        accountId: z.string(),
        networkId: z.enum(["mainnet", "testnet"]),
      }),
    )
    .output(z.object({ nonce: z.string() }))
    .errors(Errors),

  nearVerify: oc
    .route({ method: "POST", path: "/v1/near/verify" })
    .input(
      z.object({
        signedMessage: signedMessageSchema,
        message: z.string(),
        recipient: z.string(),
        nonce: z.string(),
        accountId: z.string(),
      }),
    )
    .output(
      z.object({
        token: z.string(),
        success: z.literal(true),
        user: z.object({
          id: z.string(),
          accountId: z.string(),
          network: z.enum(["mainnet", "testnet"]),
        }),
      }),
    )
    .errors(Errors),

  nearProfile: oc
    .route({ method: "POST", path: "/v1/near/profile" })
    .input(
      z.object({
        accountId: z.string().optional(),
      }),
    )
    .output(profileOutputSchema)
    .errors(Errors),

  nearLinkAccount: oc
    .route({ method: "POST", path: "/v1/near/link-account" })
    .input(
      z.object({
        signedMessage: signedMessageSchema,
        message: z.string(),
        recipient: z.string(),
        nonce: z.string(),
        accountId: z.string(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        accountId: z.string(),
        network: z.string(),
        message: z.string(),
      }),
    )
    .errors(Errors),

  nearUnlinkAccount: oc
    .route({ method: "POST", path: "/v1/near/unlink-account" })
    .input(
      z.object({
        accountId: z.string(),
        network: z.enum(["mainnet", "testnet"]).optional(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        accountId: z.string(),
        network: z.string(),
        message: z.string(),
      }),
    )
    .errors(Errors),

  nearListAccounts: oc
    .route({ method: "GET", path: "/v1/near/accounts" })
    .output(
      z.object({
        accounts: z.array(nearAccountSchema),
        activeAccount: nearAccountSchema.nullable().optional(),
        availableAccounts: z.array(nearAccountSchema).optional(),
      }),
    )
    .errors(Errors),

  nearRelay: oc
    .route({ method: "POST", path: "/v1/near/relay" })
    .input(
      z.object({
        payload: z.string(),
      }),
    )
    .output(
      z.object({
        txHash: z.string(),
        status: z.enum(["pending", "completed", "failed"]),
      }),
    )
    .errors(Errors),

  nearRelayStatus: oc
    .route({ method: "GET", path: "/v1/near/relay-status/{txHash}" })
    .input(
      z.object({
        txHash: z.string(),
      }),
    )
    .output(
      z.object({
        status: z.enum(["pending", "completed", "failed"]),
        gasUsed: z.string().optional(),
        outcome: z.unknown().optional(),
      }),
    )
    .errors(Errors),

  nearRelayerInfo: oc
    .route({ method: "POST", path: "/v1/near/relayer-info" })
    .input(
      z.object({
        network: z.enum(["mainnet", "testnet"]).optional(),
      }),
    )
    .output(relayerInfoOutputSchema)
    .errors(Errors),

  nearRelayHistory: oc
    .route({ method: "GET", path: "/v1/near/relay-history" })
    .output(z.object({ transactions: z.array(relayedTransactionSchema) }))
    .errors(Errors),

  nearView: oc
    .route({ method: "POST", path: "/v1/near/view" })
    .input(
      z.object({
        contractId: z.string(),
        methodName: z.string(),
        args: z.record(z.string(), z.any()).optional(),
      }),
    )
    .output(z.object({ result: z.unknown() }))
    .errors(Errors),

  nearCheckSubAccountAvailability: oc
    .route({ method: "POST", path: "/v1/near/check-sub-account-availability" })
    .input(
      z.object({
        subAccountId: z.string(),
        network: z.enum(["mainnet", "testnet"]).optional(),
      }),
    )
    .output(
      z.object({
        available: z.boolean(),
        accountId: z.string(),
      }),
    )
    .errors(Errors),

  nearCreateSubAccount: oc
    .route({ method: "POST", path: "/v1/near/create-sub-account" })
    .input(
      z.object({
        subAccountId: z.string(),
        publicKey: z.string(),
        network: z.enum(["mainnet", "testnet"]).optional(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        accountId: z.string(),
        txHash: z.string().optional(),
      }),
    )
    .errors(Errors),
});

export type ContractType = typeof contract;

export type InferOutput<K extends keyof InferContractRouterOutputs<ContractType>> =
  InferContractRouterOutputs<ContractType>[K];
export type InferInput<K extends keyof InferContractRouterInputs<ContractType>> =
  InferContractRouterInputs<ContractType>[K];
