import { z } from "every-plugin/zod";
export declare const contract: {
    getSession: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        session: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            token: z.ZodString;
            userId: z.ZodString;
            expiresAt: z.ZodDate;
            activeOrganizationId: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        user: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            email: z.ZodString;
            emailVerified: z.ZodBoolean;
            image: z.ZodNullable<z.ZodString>;
            role: z.ZodNullable<z.ZodString>;
            isAnonymous: z.ZodNullable<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    getContext: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        user: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            email: z.ZodString;
            emailVerified: z.ZodBoolean;
            image: z.ZodNullable<z.ZodString>;
            role: z.ZodNullable<z.ZodString>;
            isAnonymous: z.ZodNullable<z.ZodBoolean>;
        }, z.core.$strip>>;
        userId: z.ZodNullable<z.ZodString>;
        isAuthenticated: z.ZodBoolean;
        authMethod: z.ZodEnum<{
            session: "session";
            apiKey: "apiKey";
            anonymous: "anonymous";
            none: "none";
        }>;
        near: z.ZodObject<{
            primaryAccountId: z.ZodNullable<z.ZodString>;
            linkedAccounts: z.ZodArray<z.ZodObject<{
                accountId: z.ZodString;
                network: z.ZodString;
                publicKey: z.ZodString;
                isPrimary: z.ZodBoolean;
            }, z.core.$strip>>;
            hasNearAccount: z.ZodBoolean;
        }, z.core.$strip>;
        organization: z.ZodObject<{
            activeOrganizationId: z.ZodNullable<z.ZodString>;
            organization: z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                slug: z.ZodString;
                logo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, z.core.$strip>>;
            member: z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                role: z.ZodString;
            }, z.core.$strip>>;
            isPersonal: z.ZodBoolean;
            hasOrganization: z.ZodBoolean;
        }, z.core.$strip>;
        organizations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            slug: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    getActiveMember: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        organizationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodNullable<z.ZodString>;
        role: z.ZodNullable<z.ZodString>;
        organizationId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    listApiKeys: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        organizationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        prefix: z.ZodNullable<z.ZodString>;
        start: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodNullable<z.ZodDate>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
        metadata: z.ZodNullable<z.ZodUnknown>;
        permissions: z.ZodNullable<z.ZodUnknown>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    createApiKey: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        prefix: z.ZodOptional<z.ZodString>;
        expiresAt: z.ZodOptional<z.ZodDate>;
        permissions: z.ZodOptional<z.ZodUnknown>;
        metadata: z.ZodOptional<z.ZodUnknown>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            timeWindow: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        organizationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        prefix: z.ZodNullable<z.ZodString>;
        start: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodNullable<z.ZodDate>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
        metadata: z.ZodNullable<z.ZodUnknown>;
        permissions: z.ZodNullable<z.ZodUnknown>;
        key: z.ZodString;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    deleteApiKey: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    listMembers: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        organizationId: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        organizationId: z.ZodString;
        role: z.ZodString;
        createdAt: z.ZodDate;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    listInvitations: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        organizationId: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        organizationId: z.ZodString;
        email: z.ZodString;
        role: z.ZodNullable<z.ZodString>;
        status: z.ZodString;
        expiresAt: z.ZodDate;
        inviterId: z.ZodString;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    cancelInvitation: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
    resendInvitation: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        sent: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            status: number;
            message: string;
        };
        FORBIDDEN: {
            status: number;
            message: string;
        };
        NOT_FOUND: {
            status: number;
            message: string;
        };
        BAD_REQUEST: {
            status: number;
            message: string;
        };
    }>>, Record<never, never>>;
};
export type ContractType = typeof contract;
