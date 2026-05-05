import type { AuthDatabase } from "./db/layer";
export interface AuthConfig {
    account: string;
    hostUrl: string;
    uiUrl?: string;
    githubClientId?: string;
    githubClientSecret?: string;
}
export declare function createAuthInstance(config: AuthConfig, db: AuthDatabase): import("better-auth").Auth<{
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    trustedOrigins: string[];
    secret: string;
    baseURL: string;
    socialProviders: {
        github: {
            clientId: string;
            clientSecret: string;
        };
    };
    plugins: [import("better-auth").BetterAuthPlugin, {
        id: "admin";
        version: string;
        init(): {
            options: {
                databaseHooks: {
                    user: {
                        create: {
                            before(user: {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                email: string;
                                emailVerified: boolean;
                                name: string;
                                image?: string | null | undefined;
                            } & Record<string, unknown>): Promise<{
                                data: {
                                    id: string;
                                    createdAt: Date;
                                    updatedAt: Date;
                                    email: string;
                                    emailVerified: boolean;
                                    name: string;
                                    image?: string | null | undefined;
                                    role: string;
                                };
                            }>;
                        };
                    };
                    session: {
                        create: {
                            before(session: {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                userId: string;
                                expiresAt: Date;
                                token: string;
                                ipAddress?: string | null | undefined;
                                userAgent?: string | null | undefined;
                            } & Record<string, unknown>, ctx: import("better-auth").GenericEndpointContext | null): Promise<void>;
                        };
                    };
                };
            };
        };
        hooks: {
            after: {
                matcher(context: import("better-auth").HookEndpointContext): boolean;
                handler: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<import("better-auth/plugins").SessionWithImpersonatedBy[] | undefined>;
            }[];
        };
        endpoints: {
            setRole: import("better-auth").StrictEndpoint<"/admin/set-role", {
                method: "POST";
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                    role: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>]>;
                }, import("zod/v4/core").$strip>;
                requireHeaders: true;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                    $Infer: {
                        body: {
                            userId: string;
                            role: "user" | "admin" | ("user" | "admin")[];
                        };
                    };
                };
            }, {
                user: import("better-auth/plugins").UserWithRole;
            }>;
            getUser: import("better-auth").StrictEndpoint<"/admin/get-user", {
                method: "GET";
                query: import("zod").ZodObject<{
                    id: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, import("better-auth/plugins").UserWithRole>;
            createUser: import("better-auth").StrictEndpoint<"/admin/create-user", {
                method: "POST";
                body: import("zod").ZodObject<{
                    email: import("zod").ZodString;
                    password: import("zod").ZodOptional<import("zod").ZodString>;
                    name: import("zod").ZodString;
                    role: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>]>>;
                    data: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                    $Infer: {
                        body: {
                            email: string;
                            password?: string | undefined;
                            name: string;
                            role?: "user" | "admin" | ("user" | "admin")[] | undefined;
                            data?: Record<string, any> | undefined;
                        };
                    };
                };
            }, {
                user: import("better-auth/plugins").UserWithRole;
            }>;
            adminUpdateUser: import("better-auth").StrictEndpoint<"/admin/update-user", {
                method: "POST";
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                    data: import("zod").ZodRecord<import("zod").ZodAny, import("zod").ZodAny>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, import("better-auth/plugins").UserWithRole>;
            listUsers: import("better-auth").StrictEndpoint<"/admin/list-users", {
                method: "GET";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                query: import("zod").ZodObject<{
                    searchValue: import("zod").ZodOptional<import("zod").ZodString>;
                    searchField: import("zod").ZodOptional<import("zod").ZodEnum<{
                        email: "email";
                        name: "name";
                    }>>;
                    searchOperator: import("zod").ZodOptional<import("zod").ZodEnum<{
                        contains: "contains";
                        starts_with: "starts_with";
                        ends_with: "ends_with";
                    }>>;
                    limit: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
                    offset: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
                    sortBy: import("zod").ZodOptional<import("zod").ZodString>;
                    sortDirection: import("zod").ZodOptional<import("zod").ZodEnum<{
                        asc: "asc";
                        desc: "desc";
                    }>>;
                    filterField: import("zod").ZodOptional<import("zod").ZodString>;
                    filterValue: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodUnion<[import("zod").ZodUnion<[import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>, import("zod").ZodBoolean]>, import("zod").ZodArray<import("zod").ZodString>]>, import("zod").ZodArray<import("zod").ZodNumber>]>>;
                    filterOperator: import("zod").ZodOptional<import("zod").ZodEnum<{
                        eq: "eq";
                        ne: "ne";
                        gt: "gt";
                        gte: "gte";
                        lt: "lt";
                        lte: "lte";
                        in: "in";
                        not_in: "not_in";
                        contains: "contains";
                        starts_with: "starts_with";
                        ends_with: "ends_with";
                    }>>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                users: {
                                                    type: string;
                                                    items: {
                                                        $ref: string;
                                                    };
                                                };
                                                total: {
                                                    type: string;
                                                };
                                                limit: {
                                                    type: string;
                                                };
                                                offset: {
                                                    type: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                users: import("better-auth/plugins").UserWithRole[];
                total: number;
            }>;
            listUserSessions: import("better-auth").StrictEndpoint<"/admin/list-user-sessions", {
                method: "POST";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                sessions: {
                                                    type: string;
                                                    items: {
                                                        $ref: string;
                                                    };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                sessions: import("better-auth/plugins").SessionWithImpersonatedBy[];
            }>;
            unbanUser: import("better-auth").StrictEndpoint<"/admin/unban-user", {
                method: "POST";
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                user: import("better-auth/plugins").UserWithRole;
            }>;
            banUser: import("better-auth").StrictEndpoint<"/admin/ban-user", {
                method: "POST";
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                    banReason: import("zod").ZodOptional<import("zod").ZodString>;
                    banExpiresIn: import("zod").ZodOptional<import("zod").ZodNumber>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                user: import("better-auth/plugins").UserWithRole;
            }>;
            impersonateUser: import("better-auth").StrictEndpoint<"/admin/impersonate-user", {
                method: "POST";
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                session: {
                                                    $ref: string;
                                                };
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                session: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    userId: string;
                    expiresAt: Date;
                    token: string;
                    ipAddress?: string | null | undefined;
                    userAgent?: string | null | undefined;
                };
                user: import("better-auth/plugins").UserWithRole;
            }>;
            stopImpersonating: import("better-auth").StrictEndpoint<"/admin/stop-impersonating", {
                method: "POST";
                requireHeaders: true;
            }, {
                session: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    userId: string;
                    expiresAt: Date;
                    token: string;
                    ipAddress?: string | null | undefined;
                    userAgent?: string | null | undefined;
                } & Record<string, any>;
                user: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                } & Record<string, any>;
            }>;
            revokeUserSession: import("better-auth").StrictEndpoint<"/admin/revoke-user-session", {
                method: "POST";
                body: import("zod").ZodObject<{
                    sessionToken: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                success: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                success: boolean;
            }>;
            revokeUserSessions: import("better-auth").StrictEndpoint<"/admin/revoke-user-sessions", {
                method: "POST";
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                success: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                success: boolean;
            }>;
            removeUser: import("better-auth").StrictEndpoint<"/admin/remove-user", {
                method: "POST";
                body: import("zod").ZodObject<{
                    userId: import("zod").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                success: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                success: boolean;
            }>;
            setUserPassword: import("better-auth").StrictEndpoint<"/admin/set-user-password", {
                method: "POST";
                body: import("zod").ZodObject<{
                    newPassword: import("zod").ZodString;
                    userId: import("zod").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        user: import("better-auth/plugins").UserWithRole;
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            userHasPermission: import("better-auth").StrictEndpoint<"/admin/has-permission", {
                method: "POST";
                body: import("zod").ZodIntersection<import("zod").ZodObject<{
                    userId: import("zod").ZodOptional<import("zod").ZodCoercedString<unknown>>;
                    role: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>, import("zod").ZodXor<readonly [import("zod").ZodObject<{
                    permission: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    permissions: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>>;
                }, import("zod/v4/core").$strip>]>>;
                metadata: {
                    openapi: {
                        description: string;
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object";
                                        properties: {
                                            permissions: {
                                                type: string;
                                                description: string;
                                            };
                                        };
                                        required: string[];
                                    };
                                };
                            };
                        };
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                error: {
                                                    type: string;
                                                };
                                                success: {
                                                    type: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                    $Infer: {
                        body: {
                            permissions: {
                                readonly user?: ("get" | "set-role" | "create" | "update" | "delete" | "list" | "ban" | "impersonate" | "impersonate-admins" | "set-password")[] | undefined;
                                readonly session?: ("delete" | "list" | "revoke")[] | undefined;
                            };
                        } & {
                            userId?: string | undefined;
                            role?: "user" | "admin" | undefined;
                        };
                    };
                };
            }, {
                error: null;
                success: boolean;
            }>;
        };
        $ERROR_CODES: {
            USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
            FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
            USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
            YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
            YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
            YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
            YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
            YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
            YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
            BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
            YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
            NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
            YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
            YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
            YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
            YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
            INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
        };
        schema: {
            user: {
                fields: {
                    role: {
                        type: "string";
                        required: false;
                        input: false;
                    };
                    banned: {
                        type: "boolean";
                        defaultValue: false;
                        required: false;
                        input: false;
                    };
                    banReason: {
                        type: "string";
                        required: false;
                        input: false;
                    };
                    banExpires: {
                        type: "date";
                        required: false;
                        input: false;
                    };
                };
            };
            session: {
                fields: {
                    impersonatedBy: {
                        type: "string";
                        required: false;
                    };
                };
            };
        };
        options: NoInfer<{
            defaultRole: string;
            adminRoles: string[];
        }>;
    }, {
        id: "anonymous";
        version: string;
        endpoints: {
            signInAnonymous: import("better-auth").StrictEndpoint<"/sign-in/anonymous", {
                method: "POST";
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                                session: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
            deleteAnonymousUser: import("better-auth").StrictEndpoint<"/delete-anonymous-user", {
                method: "POST";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                success: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                            "400": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                message: {
                                                    type: string;
                                                };
                                            };
                                        };
                                        required: string[];
                                    };
                                };
                            };
                            "500": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                message: {
                                                    type: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                success: boolean;
            }>;
        };
        hooks: {
            after: {
                matcher(ctx: import("better-auth").HookEndpointContext): boolean;
                handler: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>;
            }[];
        };
        options: import("better-auth/plugins").AnonymousOptions | undefined;
        schema: {
            user: {
                fields: {
                    isAnonymous: {
                        type: "boolean";
                        required: false;
                        input: false;
                        defaultValue: false;
                    };
                };
            };
        };
        $ERROR_CODES: {
            FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
            INVALID_EMAIL_FORMAT: import("better-auth").RawError<"INVALID_EMAIL_FORMAT">;
            COULD_NOT_CREATE_SESSION: import("better-auth").RawError<"COULD_NOT_CREATE_SESSION">;
            ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY: import("better-auth").RawError<"ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY">;
            FAILED_TO_DELETE_ANONYMOUS_USER: import("better-auth").RawError<"FAILED_TO_DELETE_ANONYMOUS_USER">;
            USER_IS_NOT_ANONYMOUS: import("better-auth").RawError<"USER_IS_NOT_ANONYMOUS">;
            DELETE_ANONYMOUS_USER_DISABLED: import("better-auth").RawError<"DELETE_ANONYMOUS_USER_DISABLED">;
        };
    }, {
        id: "phone-number";
        version: string;
        init(): {
            options: {
                databaseHooks: {
                    user: {
                        update: {
                            before(data: Partial<{
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                email: string;
                                emailVerified: boolean;
                                name: string;
                                image?: string | null | undefined;
                            }> & Record<string, unknown>): Promise<{
                                data: {
                                    [x: string]: unknown;
                                    id?: string | undefined;
                                    createdAt?: Date | undefined;
                                    updatedAt?: Date | undefined;
                                    email?: string | undefined;
                                    emailVerified?: boolean | undefined;
                                    name?: string | undefined;
                                    image?: string | null | undefined;
                                };
                            } | undefined>;
                        };
                    };
                };
            };
        };
        hooks: {
            before: {
                matcher: (ctx: import("better-auth").HookEndpointContext) => boolean;
                handler: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<never>;
            }[];
        };
        endpoints: {
            signInPhoneNumber: import("better-auth").StrictEndpoint<"/sign-in/phone-number", {
                method: "POST";
                body: import("zod").ZodObject<{
                    phoneNumber: import("zod").ZodString;
                    password: import("zod").ZodString;
                    rememberMe: import("zod").ZodOptional<import("zod").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    $ref: string;
                                                };
                                                session: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                            400: {
                                description: string;
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: import("better-auth/plugins").UserWithPhoneNumber;
            }>;
            sendPhoneNumberOTP: import("better-auth").StrictEndpoint<"/phone-number/send-otp", {
                method: "POST";
                body: import("zod").ZodObject<{
                    phoneNumber: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                message: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                message: string;
            }>;
            verifyPhoneNumber: import("better-auth").StrictEndpoint<"/phone-number/verify", {
                method: "POST";
                body: import("zod").ZodIntersection<import("zod").ZodObject<{
                    phoneNumber: import("zod").ZodString;
                    code: import("zod").ZodString;
                    disableSession: import("zod").ZodOptional<import("zod").ZodBoolean>;
                    updatePhoneNumber: import("zod").ZodOptional<import("zod").ZodBoolean>;
                }, import("zod/v4/core").$strip>, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                    description: string;
                                                    enum: boolean[];
                                                };
                                                token: {
                                                    type: string;
                                                    nullable: boolean;
                                                    description: string;
                                                };
                                                user: {
                                                    type: string;
                                                    nullable: boolean;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        email: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        emailVerified: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        image: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        phoneNumber: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        phoneNumberVerified: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        updatedAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                            400: {
                                description: string;
                            };
                        };
                    };
                };
            }, {
                status: boolean;
                token: string;
                user: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                } & import("better-auth/plugins").UserWithPhoneNumber;
            } | {
                status: boolean;
                token: null;
                user: import("better-auth/plugins").UserWithPhoneNumber;
            }>;
            requestPasswordResetPhoneNumber: import("better-auth").StrictEndpoint<"/phone-number/request-password-reset", {
                method: "POST";
                body: import("zod").ZodObject<{
                    phoneNumber: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                    description: string;
                                                    enum: boolean[];
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            resetPasswordPhoneNumber: import("better-auth").StrictEndpoint<"/phone-number/reset-password", {
                method: "POST";
                body: import("zod").ZodObject<{
                    otp: import("zod").ZodString;
                    phoneNumber: import("zod").ZodString;
                    newPassword: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                    description: string;
                                                    enum: boolean[];
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
        };
        schema: {
            user: {
                fields: {
                    phoneNumber: {
                        type: "string";
                        required: false;
                        unique: true;
                        sortable: true;
                        returned: true;
                    };
                    phoneNumberVerified: {
                        type: "boolean";
                        required: false;
                        returned: true;
                        input: false;
                    };
                };
            };
        };
        rateLimit: {
            pathMatcher(path: string): boolean;
            window: number;
            max: number;
        }[];
        options: import("better-auth/plugins").PhoneNumberOptions | undefined;
        $ERROR_CODES: {
            OTP_EXPIRED: import("better-auth").RawError<"OTP_EXPIRED">;
            INVALID_OTP: import("better-auth").RawError<"INVALID_OTP">;
            TOO_MANY_ATTEMPTS: import("better-auth").RawError<"TOO_MANY_ATTEMPTS">;
            INVALID_PHONE_NUMBER: import("better-auth").RawError<"INVALID_PHONE_NUMBER">;
            PHONE_NUMBER_EXIST: import("better-auth").RawError<"PHONE_NUMBER_EXIST">;
            PHONE_NUMBER_NOT_EXIST: import("better-auth").RawError<"PHONE_NUMBER_NOT_EXIST">;
            INVALID_PHONE_NUMBER_OR_PASSWORD: import("better-auth").RawError<"INVALID_PHONE_NUMBER_OR_PASSWORD">;
            UNEXPECTED_ERROR: import("better-auth").RawError<"UNEXPECTED_ERROR">;
            OTP_NOT_FOUND: import("better-auth").RawError<"OTP_NOT_FOUND">;
            PHONE_NUMBER_NOT_VERIFIED: import("better-auth").RawError<"PHONE_NUMBER_NOT_VERIFIED">;
            PHONE_NUMBER_CANNOT_BE_UPDATED: import("better-auth").RawError<"PHONE_NUMBER_CANNOT_BE_UPDATED">;
            SEND_OTP_NOT_IMPLEMENTED: import("better-auth").RawError<"SEND_OTP_NOT_IMPLEMENTED">;
        };
    }, {
        id: "passkey";
        version: string;
        endpoints: {
            generatePasskeyRegistrationOptions: import("better-auth").StrictEndpoint<"/passkey/generate-register-options", {
                method: "GET";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                query: import("zod").ZodOptional<import("zod").ZodObject<{
                    authenticatorAttachment: import("zod").ZodOptional<import("zod").ZodEnum<{
                        platform: "platform";
                        "cross-platform": "cross-platform";
                    }>>;
                    name: import("zod").ZodOptional<import("zod").ZodString>;
                    context: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>;
                metadata: {
                    openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                parameters: {
                                    query: {
                                        authenticatorAttachment: {
                                            description: string;
                                            required: boolean;
                                        };
                                        name: {
                                            description: string;
                                            required: boolean;
                                        };
                                        context: {
                                            description: string;
                                            required: boolean;
                                        };
                                    };
                                };
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                challenge: {
                                                    type: string;
                                                };
                                                rp: {
                                                    type: string;
                                                    properties: {
                                                        name: {
                                                            type: string;
                                                        };
                                                        id: {
                                                            type: string;
                                                        };
                                                    };
                                                };
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                        };
                                                        displayName: {
                                                            type: string;
                                                        };
                                                    };
                                                };
                                                pubKeyCredParams: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                        properties: {
                                                            type: {
                                                                type: string;
                                                            };
                                                            alg: {
                                                                type: string;
                                                            };
                                                        };
                                                    };
                                                };
                                                timeout: {
                                                    type: string;
                                                };
                                                excludeCredentials: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                        properties: {
                                                            id: {
                                                                type: string;
                                                            };
                                                            type: {
                                                                type: string;
                                                            };
                                                            transports: {
                                                                type: string;
                                                                items: {
                                                                    type: string;
                                                                };
                                                            };
                                                        };
                                                    };
                                                };
                                                authenticatorSelection: {
                                                    type: string;
                                                    properties: {
                                                        authenticatorAttachment: {
                                                            type: string;
                                                        };
                                                        requireResidentKey: {
                                                            type: string;
                                                        };
                                                        userVerification: {
                                                            type: string;
                                                        };
                                                    };
                                                };
                                                attestation: {
                                                    type: string;
                                                };
                                                extensions: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, import("@simplewebauthn/server").PublicKeyCredentialCreationOptionsJSON>;
            generatePasskeyAuthenticationOptions: import("better-auth").StrictEndpoint<"/passkey/generate-authenticate-options", {
                method: "GET";
                metadata: {
                    openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                challenge: {
                                                    type: string;
                                                };
                                                rp: {
                                                    type: string;
                                                    properties: {
                                                        name: {
                                                            type: string;
                                                        };
                                                        id: {
                                                            type: string;
                                                        };
                                                    };
                                                };
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                        };
                                                        displayName: {
                                                            type: string;
                                                        };
                                                    };
                                                };
                                                timeout: {
                                                    type: string;
                                                };
                                                allowCredentials: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                        properties: {
                                                            id: {
                                                                type: string;
                                                            };
                                                            type: {
                                                                type: string;
                                                            };
                                                            transports: {
                                                                type: string;
                                                                items: {
                                                                    type: string;
                                                                };
                                                            };
                                                        };
                                                    };
                                                };
                                                userVerification: {
                                                    type: string;
                                                };
                                                authenticatorSelection: {
                                                    type: string;
                                                    properties: {
                                                        authenticatorAttachment: {
                                                            type: string;
                                                        };
                                                        requireResidentKey: {
                                                            type: string;
                                                        };
                                                        userVerification: {
                                                            type: string;
                                                        };
                                                    };
                                                };
                                                extensions: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, import("@simplewebauthn/server").PublicKeyCredentialRequestOptionsJSON>;
            verifyPasskeyRegistration: import("better-auth").StrictEndpoint<"/passkey/verify-registration", {
                method: "POST";
                body: import("zod").ZodObject<{
                    response: import("zod").ZodAny;
                    name: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                            400: {
                                description: string;
                            };
                        };
                    };
                };
            }, import("@better-auth/passkey").Passkey>;
            verifyPasskeyAuthentication: import("better-auth").StrictEndpoint<"/passkey/verify-authentication", {
                method: "POST";
                body: import("zod").ZodObject<{
                    response: import("zod").ZodRecord<import("zod").ZodAny, import("zod").ZodAny>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        operationId: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                session: {
                                                    $ref: string;
                                                };
                                                user: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                    $Infer: {
                        body: {
                            response: import("@simplewebauthn/server").AuthenticationResponseJSON;
                        };
                    };
                };
            }, {
                session: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    userId: string;
                    expiresAt: Date;
                    token: string;
                    ipAddress?: string | null | undefined;
                    userAgent?: string | null | undefined;
                };
                user: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
            listPasskeys: import("better-auth").StrictEndpoint<"/passkey/list-user-passkeys", {
                method: "GET";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array";
                                            items: {
                                                $ref: string;
                                                required: string[];
                                            };
                                            description: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, import("@better-auth/passkey").Passkey[]>;
            deletePasskey: import("better-auth").StrictEndpoint<"/passkey/delete-passkey", {
                method: "POST";
                body: import("zod").ZodObject<{
                    id: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                use: (((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    verifiedResource: {};
                }>))[];
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            updatePasskey: import("better-auth").StrictEndpoint<"/passkey/update-passkey", {
                method: "POST";
                body: import("zod").ZodObject<{
                    id: import("zod").ZodString;
                    name: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                use: (((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    verifiedResource: {};
                }>))[];
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                passkey: {
                                                    $ref: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                passkey: import("@better-auth/passkey").Passkey;
            }>;
        };
        schema: {
            passkey: {
                fields: {
                    name: {
                        type: "string";
                        required: false;
                    };
                    publicKey: {
                        type: "string";
                        required: true;
                    };
                    userId: {
                        type: "string";
                        references: {
                            model: string;
                            field: string;
                        };
                        required: true;
                        index: true;
                    };
                    credentialID: {
                        type: "string";
                        required: true;
                        index: true;
                    };
                    counter: {
                        type: "number";
                        required: true;
                    };
                    deviceType: {
                        type: "string";
                        required: true;
                    };
                    backedUp: {
                        type: "boolean";
                        required: true;
                    };
                    transports: {
                        type: "string";
                        required: false;
                    };
                    createdAt: {
                        type: "date";
                        required: false;
                    };
                    aaguid: {
                        type: "string";
                        required: false;
                    };
                };
            };
        };
        $ERROR_CODES: {
            CHALLENGE_NOT_FOUND: import("better-auth").RawError<"CHALLENGE_NOT_FOUND">;
            YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY">;
            FAILED_TO_VERIFY_REGISTRATION: import("better-auth").RawError<"FAILED_TO_VERIFY_REGISTRATION">;
            PASSKEY_NOT_FOUND: import("better-auth").RawError<"PASSKEY_NOT_FOUND">;
            AUTHENTICATION_FAILED: import("better-auth").RawError<"AUTHENTICATION_FAILED">;
            UNABLE_TO_CREATE_SESSION: import("better-auth").RawError<"UNABLE_TO_CREATE_SESSION">;
            FAILED_TO_UPDATE_PASSKEY: import("better-auth").RawError<"FAILED_TO_UPDATE_PASSKEY">;
            PREVIOUSLY_REGISTERED: import("better-auth").RawError<"PREVIOUSLY_REGISTERED">;
            REGISTRATION_CANCELLED: import("better-auth").RawError<"REGISTRATION_CANCELLED">;
            AUTH_CANCELLED: import("better-auth").RawError<"AUTH_CANCELLED">;
            UNKNOWN_ERROR: import("better-auth").RawError<"UNKNOWN_ERROR">;
            SESSION_REQUIRED: import("better-auth").RawError<"SESSION_REQUIRED">;
            RESOLVE_USER_REQUIRED: import("better-auth").RawError<"RESOLVE_USER_REQUIRED">;
            RESOLVED_USER_INVALID: import("better-auth").RawError<"RESOLVED_USER_INVALID">;
        };
        options: import("@better-auth/passkey").PasskeyOptions | undefined;
    }, import("better-auth/plugins").DefaultOrganizationPlugin<{
        sendInvitationEmail(data: {
            id: string;
            role: string;
            email: string;
            organization: import("better-auth/plugins").Organization;
            invitation: import("better-auth/plugins").Invitation;
            inviter: import("better-auth/plugins").Member & {
                user: import("better-auth").User;
            };
        }): Promise<void>;
    }>, {
        id: "api-key";
        version: string;
        $ERROR_CODES: {
            INVALID_METADATA_TYPE: import("better-auth").RawError<"INVALID_METADATA_TYPE">;
            REFILL_AMOUNT_AND_INTERVAL_REQUIRED: import("better-auth").RawError<"REFILL_AMOUNT_AND_INTERVAL_REQUIRED">;
            REFILL_INTERVAL_AND_AMOUNT_REQUIRED: import("better-auth").RawError<"REFILL_INTERVAL_AND_AMOUNT_REQUIRED">;
            USER_BANNED: import("better-auth").RawError<"USER_BANNED">;
            UNAUTHORIZED_SESSION: import("better-auth").RawError<"UNAUTHORIZED_SESSION">;
            KEY_NOT_FOUND: import("better-auth").RawError<"KEY_NOT_FOUND">;
            KEY_DISABLED: import("better-auth").RawError<"KEY_DISABLED">;
            KEY_EXPIRED: import("better-auth").RawError<"KEY_EXPIRED">;
            USAGE_EXCEEDED: import("better-auth").RawError<"USAGE_EXCEEDED">;
            KEY_NOT_RECOVERABLE: import("better-auth").RawError<"KEY_NOT_RECOVERABLE">;
            EXPIRES_IN_IS_TOO_SMALL: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_SMALL">;
            EXPIRES_IN_IS_TOO_LARGE: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_LARGE">;
            INVALID_REMAINING: import("better-auth").RawError<"INVALID_REMAINING">;
            INVALID_PREFIX_LENGTH: import("better-auth").RawError<"INVALID_PREFIX_LENGTH">;
            INVALID_NAME_LENGTH: import("better-auth").RawError<"INVALID_NAME_LENGTH">;
            METADATA_DISABLED: import("better-auth").RawError<"METADATA_DISABLED">;
            RATE_LIMIT_EXCEEDED: import("better-auth").RawError<"RATE_LIMIT_EXCEEDED">;
            NO_VALUES_TO_UPDATE: import("better-auth").RawError<"NO_VALUES_TO_UPDATE">;
            KEY_DISABLED_EXPIRATION: import("better-auth").RawError<"KEY_DISABLED_EXPIRATION">;
            INVALID_API_KEY: import("better-auth").RawError<"INVALID_API_KEY">;
            INVALID_USER_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_USER_ID_FROM_API_KEY">;
            INVALID_REFERENCE_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_REFERENCE_ID_FROM_API_KEY">;
            INVALID_API_KEY_GETTER_RETURN_TYPE: import("better-auth").RawError<"INVALID_API_KEY_GETTER_RETURN_TYPE">;
            SERVER_ONLY_PROPERTY: import("better-auth").RawError<"SERVER_ONLY_PROPERTY">;
            FAILED_TO_UPDATE_API_KEY: import("better-auth").RawError<"FAILED_TO_UPDATE_API_KEY">;
            NAME_REQUIRED: import("better-auth").RawError<"NAME_REQUIRED">;
            ORGANIZATION_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_ID_REQUIRED">;
            USER_NOT_MEMBER_OF_ORGANIZATION: import("better-auth").RawError<"USER_NOT_MEMBER_OF_ORGANIZATION">;
            INSUFFICIENT_API_KEY_PERMISSIONS: import("better-auth").RawError<"INSUFFICIENT_API_KEY_PERMISSIONS">;
            NO_DEFAULT_API_KEY_CONFIGURATION_FOUND: import("better-auth").RawError<"NO_DEFAULT_API_KEY_CONFIGURATION_FOUND">;
            ORGANIZATION_PLUGIN_REQUIRED: import("better-auth").RawError<"ORGANIZATION_PLUGIN_REQUIRED">;
        };
        hooks: {
            before: {
                matcher: (ctx: import("better-auth").HookEndpointContext) => boolean;
                handler: (inputContext: {
                    body?: undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    use?: any[];
                }) => Promise<{
                    user: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        email: string;
                        emailVerified: boolean;
                        name: string;
                        image?: string | null | undefined;
                    };
                    session: {
                        id: string;
                        token: string;
                        userId: string;
                        userAgent: string | null;
                        ipAddress: string | null;
                        createdAt: Date;
                        updatedAt: Date;
                        expiresAt: Date;
                    };
                } | {
                    context: {
                        method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
                        path: string;
                        body: any;
                        query: Record<string, any> | undefined;
                        params: Record<string, any> | undefined;
                        request: Request | undefined;
                        headers: Headers | undefined;
                        setHeader: (key: string, value: string) => void;
                        setStatus: (status: 200 | 400 | 100 | 101 | 102 | 103 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226 | 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451 | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511) => void;
                        getHeader: (key: string) => string | null;
                        getCookie: (key: string, prefix?: "host" | "secure") => string | null;
                        getSignedCookie: (key: string, secret: string, prefix?: "host" | "secure") => Promise<string | null | false>;
                        setCookie: (key: string, value: string, options?: {
                            domain?: string;
                            expires?: Date;
                            httpOnly?: boolean;
                            maxAge?: number;
                            path?: string;
                            secure?: boolean;
                            sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none";
                            partitioned?: boolean;
                            prefix?: "host" | "secure";
                        }) => string;
                        setSignedCookie: (key: string, value: string, secret: string, options?: {
                            domain?: string;
                            expires?: Date;
                            httpOnly?: boolean;
                            maxAge?: number;
                            path?: string;
                            secure?: boolean;
                            sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none";
                            partitioned?: boolean;
                            prefix?: "host" | "secure";
                        }) => Promise<string>;
                        json: <R extends Record<string, any> | null>(json: R, routerResponse?: {
                            status?: number;
                            headers?: Record<string, string>;
                            response?: Response;
                            body?: Record<string, string>;
                        } | Response) => Promise<R>;
                        context: {
                            [x: string]: any;
                        };
                        redirect: (url: string) => {
                            status: ("OK" | "CREATED" | "ACCEPTED" | "NO_CONTENT" | "MULTIPLE_CHOICES" | "MOVED_PERMANENTLY" | "FOUND" | "SEE_OTHER" | "NOT_MODIFIED" | "TEMPORARY_REDIRECT" | "BAD_REQUEST" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "NOT_ACCEPTABLE" | "PROXY_AUTHENTICATION_REQUIRED" | "REQUEST_TIMEOUT" | "CONFLICT" | "GONE" | "LENGTH_REQUIRED" | "PRECONDITION_FAILED" | "PAYLOAD_TOO_LARGE" | "URI_TOO_LONG" | "UNSUPPORTED_MEDIA_TYPE" | "RANGE_NOT_SATISFIABLE" | "EXPECTATION_FAILED" | "I'M_A_TEAPOT" | "MISDIRECTED_REQUEST" | "UNPROCESSABLE_ENTITY" | "LOCKED" | "FAILED_DEPENDENCY" | "TOO_EARLY" | "UPGRADE_REQUIRED" | "PRECONDITION_REQUIRED" | "TOO_MANY_REQUESTS" | "REQUEST_HEADER_FIELDS_TOO_LARGE" | "UNAVAILABLE_FOR_LEGAL_REASONS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "HTTP_VERSION_NOT_SUPPORTED" | "VARIANT_ALSO_NEGOTIATES" | "INSUFFICIENT_STORAGE" | "LOOP_DETECTED" | "NOT_EXTENDED" | "NETWORK_AUTHENTICATION_REQUIRED") | (200 | 400 | 100 | 101 | 102 | 103 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226 | 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451 | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511);
                            body: ({
                                message?: string;
                                code?: string;
                                cause?: unknown;
                            } & Record<string, any>) | undefined;
                            headers: HeadersInit;
                            statusCode: number;
                            name: string;
                            message: string;
                            stack?: string;
                            cause?: unknown;
                        };
                        error: (status: ("OK" | "CREATED" | "ACCEPTED" | "NO_CONTENT" | "MULTIPLE_CHOICES" | "MOVED_PERMANENTLY" | "FOUND" | "SEE_OTHER" | "NOT_MODIFIED" | "TEMPORARY_REDIRECT" | "BAD_REQUEST" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "NOT_ACCEPTABLE" | "PROXY_AUTHENTICATION_REQUIRED" | "REQUEST_TIMEOUT" | "CONFLICT" | "GONE" | "LENGTH_REQUIRED" | "PRECONDITION_FAILED" | "PAYLOAD_TOO_LARGE" | "URI_TOO_LONG" | "UNSUPPORTED_MEDIA_TYPE" | "RANGE_NOT_SATISFIABLE" | "EXPECTATION_FAILED" | "I'M_A_TEAPOT" | "MISDIRECTED_REQUEST" | "UNPROCESSABLE_ENTITY" | "LOCKED" | "FAILED_DEPENDENCY" | "TOO_EARLY" | "UPGRADE_REQUIRED" | "PRECONDITION_REQUIRED" | "TOO_MANY_REQUESTS" | "REQUEST_HEADER_FIELDS_TOO_LARGE" | "UNAVAILABLE_FOR_LEGAL_REASONS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "HTTP_VERSION_NOT_SUPPORTED" | "VARIANT_ALSO_NEGOTIATES" | "INSUFFICIENT_STORAGE" | "LOOP_DETECTED" | "NOT_EXTENDED" | "NETWORK_AUTHENTICATION_REQUIRED") | (200 | 400 | 100 | 101 | 102 | 103 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226 | 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451 | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511), body?: {
                            message?: string;
                            code?: string;
                        } & Record<string, any>, headers?: HeadersInit) => {
                            status: ("OK" | "CREATED" | "ACCEPTED" | "NO_CONTENT" | "MULTIPLE_CHOICES" | "MOVED_PERMANENTLY" | "FOUND" | "SEE_OTHER" | "NOT_MODIFIED" | "TEMPORARY_REDIRECT" | "BAD_REQUEST" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "NOT_ACCEPTABLE" | "PROXY_AUTHENTICATION_REQUIRED" | "REQUEST_TIMEOUT" | "CONFLICT" | "GONE" | "LENGTH_REQUIRED" | "PRECONDITION_FAILED" | "PAYLOAD_TOO_LARGE" | "URI_TOO_LONG" | "UNSUPPORTED_MEDIA_TYPE" | "RANGE_NOT_SATISFIABLE" | "EXPECTATION_FAILED" | "I'M_A_TEAPOT" | "MISDIRECTED_REQUEST" | "UNPROCESSABLE_ENTITY" | "LOCKED" | "FAILED_DEPENDENCY" | "TOO_EARLY" | "UPGRADE_REQUIRED" | "PRECONDITION_REQUIRED" | "TOO_MANY_REQUESTS" | "REQUEST_HEADER_FIELDS_TOO_LARGE" | "UNAVAILABLE_FOR_LEGAL_REASONS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "HTTP_VERSION_NOT_SUPPORTED" | "VARIANT_ALSO_NEGOTIATES" | "INSUFFICIENT_STORAGE" | "LOOP_DETECTED" | "NOT_EXTENDED" | "NETWORK_AUTHENTICATION_REQUIRED") | (200 | 400 | 100 | 101 | 102 | 103 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226 | 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451 | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511);
                            body: ({
                                message?: string;
                                code?: string;
                                cause?: unknown;
                            } & Record<string, any>) | undefined;
                            headers: HeadersInit;
                            statusCode: number;
                            name: string;
                            message: string;
                            stack?: string;
                            cause?: unknown;
                        };
                    } & {
                        method: string;
                        path: string;
                        body: any;
                        query: Record<string, any> | undefined;
                        params: string;
                        request: Request | undefined;
                        headers: Headers | undefined;
                        setHeader: (key: string, value: string) => void;
                        getHeader: (key: string) => string | null;
                        json: <R extends Record<string, any> | null>(json: R, routerResponse?: {
                            status?: number;
                            headers?: Record<string, string>;
                            response?: Response;
                        } | Response) => Promise<R>;
                        context: {
                            returned?: unknown | undefined;
                            responseHeaders?: Headers | undefined;
                            getPlugin: <ID extends import("better-auth").BetterAuthPluginRegistryIdentifier | import("better-auth").LiteralString, PluginOptions extends never>(pluginId: ID) => (ID extends keyof import("better-auth").BetterAuthPluginRegistry<unknown, unknown> ? import("better-auth").BetterAuthPluginRegistry<import("better-auth").BetterAuthOptions, PluginOptions>[ID] extends {
                                creator: infer C;
                            } ? C extends (...args: any[]) => infer R ? R : never : never : import("better-auth").BetterAuthPlugin) | null;
                            hasPlugin: <ID extends import("better-auth").BetterAuthPluginRegistryIdentifier | import("better-auth").LiteralString>(pluginId: ID) => ID extends never ? true : boolean;
                            appName: string;
                            baseURL: string;
                            version: string;
                            options: import("better-auth").BetterAuthOptions;
                            trustedOrigins: string[];
                            trustedProviders: string[];
                            isTrustedOrigin: (url: string, settings?: {
                                allowRelativePaths: boolean;
                            }) => boolean;
                            oauthConfig: {
                                skipStateCookieCheck?: boolean | undefined;
                                storeStateStrategy: "database" | "cookie";
                            };
                            newSession: {
                                session: {
                                    id: string;
                                    createdAt: Date;
                                    updatedAt: Date;
                                    userId: string;
                                    expiresAt: Date;
                                    token: string;
                                    ipAddress?: string | null | undefined;
                                    userAgent?: string | null | undefined;
                                } & Record<string, any>;
                                user: {
                                    id: string;
                                    createdAt: Date;
                                    updatedAt: Date;
                                    email: string;
                                    emailVerified: boolean;
                                    name: string;
                                    image?: string | null | undefined;
                                } & Record<string, any>;
                            } | null;
                            session: {
                                session: {
                                    id: string;
                                    createdAt: Date;
                                    updatedAt: Date;
                                    userId: string;
                                    expiresAt: Date;
                                    token: string;
                                    ipAddress?: string | null | undefined;
                                    userAgent?: string | null | undefined;
                                } & Record<string, any>;
                                user: {
                                    id: string;
                                    createdAt: Date;
                                    updatedAt: Date;
                                    email: string;
                                    emailVerified: boolean;
                                    name: string;
                                    image?: string | null | undefined;
                                } & Record<string, any>;
                            } | null;
                            setNewSession: (session: {
                                session: {
                                    id: string;
                                    createdAt: Date;
                                    updatedAt: Date;
                                    userId: string;
                                    expiresAt: Date;
                                    token: string;
                                    ipAddress?: string | null | undefined;
                                    userAgent?: string | null | undefined;
                                } & Record<string, any>;
                                user: {
                                    id: string;
                                    createdAt: Date;
                                    updatedAt: Date;
                                    email: string;
                                    emailVerified: boolean;
                                    name: string;
                                    image?: string | null | undefined;
                                } & Record<string, any>;
                            } | null) => void;
                            socialProviders: import("better-auth").OAuthProvider[];
                            authCookies: import("better-auth").BetterAuthCookies;
                            logger: ReturnType<(options?: import("better-auth").Logger | undefined) => import("better-auth").InternalLogger>;
                            rateLimit: {
                                enabled: boolean;
                                window: number;
                                max: number;
                                storage: "memory" | "database" | "secondary-storage";
                            } & Omit<import("better-auth").BetterAuthRateLimitOptions, "enabled" | "window" | "max" | "storage">;
                            adapter: import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
                            internalAdapter: import("better-auth").InternalAdapter<import("better-auth").BetterAuthOptions>;
                            createAuthCookie: (cookieName: string, overrideAttributes?: Partial<{
                                domain?: string;
                                expires?: Date;
                                httpOnly?: boolean;
                                maxAge?: number;
                                path?: string;
                                secure?: boolean;
                                sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none";
                                partitioned?: boolean;
                                prefix?: "host" | "secure";
                            }> | undefined) => import("better-auth").BetterAuthCookie;
                            secret: string;
                            secretConfig: string | import("better-auth").SecretConfig;
                            sessionConfig: {
                                updateAge: number;
                                expiresIn: number;
                                freshAge: number;
                                cookieRefreshCache: false | {
                                    enabled: true;
                                    updateAge: number;
                                };
                            };
                            generateId: (options: {
                                model: import("better-auth").ModelNames;
                                size?: number | undefined;
                            }) => string | false;
                            secondaryStorage: import("better-auth").SecondaryStorage | undefined;
                            password: {
                                hash: (password: string) => Promise<string>;
                                verify: (data: {
                                    password: string;
                                    hash: string;
                                }) => Promise<boolean>;
                                config: {
                                    minPasswordLength: number;
                                    maxPasswordLength: number;
                                };
                                checkPassword: (userId: string, ctx: import("better-auth").GenericEndpointContext<import("better-auth").BetterAuthOptions>) => Promise<boolean>;
                            };
                            tables: import("better-auth").BetterAuthDBSchema;
                            runMigrations: () => Promise<void>;
                            publishTelemetry: (event: {
                                type: string;
                                anonymousId?: string | undefined;
                                payload: Record<string, any>;
                            }) => Promise<void>;
                            skipOriginCheck: boolean | string[];
                            skipCSRFCheck: boolean;
                            runInBackground: (promise: Promise<unknown>) => void;
                            runInBackgroundOrAwait: (promise: Promise<unknown> | void) => import("better-auth").Awaitable<unknown>;
                        };
                    };
                }>;
            }[];
        };
        endpoints: {
            createApiKey: {
                (context: {
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    asResponse: true;
                }): Promise<Response>;
                (context: {
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: true;
                }): Promise<{
                    headers: Headers;
                    status: number;
                    response: {
                        key: string;
                        metadata: any;
                        permissions: any;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: false;
                }): Promise<{
                    headers: Headers;
                    response: {
                        key: string;
                        metadata: any;
                        permissions: any;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        key: string;
                        metadata: any;
                        permissions: any;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: false;
                }): Promise<{
                    key: string;
                    metadata: any;
                    permissions: any;
                    id: string;
                    configId: string;
                    name: string | null;
                    start: string | null;
                    prefix: string | null;
                    referenceId: string;
                    refillInterval: number | null;
                    refillAmount: number | null;
                    lastRefillAt: Date | null;
                    enabled: boolean;
                    rateLimitEnabled: boolean;
                    rateLimitTimeWindow: number | null;
                    rateLimitMax: number | null;
                    requestCount: number;
                    remaining: number | null;
                    lastRequest: Date | null;
                    expiresAt: Date | null;
                    createdAt: Date;
                    updatedAt: Date;
                }>;
                (context: {
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                }): Promise<{
                    headers: Headers;
                    response: {
                        key: string;
                        metadata: any;
                        permissions: any;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        key: string;
                        metadata: any;
                        permissions: any;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context?: ({
                    body: {
                        configId?: string | undefined;
                        name?: string | undefined;
                        expiresIn?: number | null | undefined;
                        prefix?: string | undefined;
                        remaining?: number | null | undefined;
                        metadata?: any;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        permissions?: Record<string, string[]> | undefined;
                        userId?: unknown;
                        organizationId?: unknown;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                }) | undefined): Promise<{
                    key: string;
                    metadata: any;
                    permissions: any;
                    id: string;
                    configId: string;
                    name: string | null;
                    start: string | null;
                    prefix: string | null;
                    referenceId: string;
                    refillInterval: number | null;
                    refillAmount: number | null;
                    lastRefillAt: Date | null;
                    enabled: boolean;
                    rateLimitEnabled: boolean;
                    rateLimitTimeWindow: number | null;
                    rateLimitMax: number | null;
                    requestCount: number;
                    remaining: number | null;
                    lastRequest: Date | null;
                    expiresAt: Date | null;
                    createdAt: Date;
                    updatedAt: Date;
                }>;
                options: {
                    method: "POST";
                    body: import("zod").ZodObject<{
                        configId: import("zod").ZodOptional<import("zod").ZodString>;
                        name: import("zod").ZodOptional<import("zod").ZodString>;
                        expiresIn: import("zod").ZodDefault<import("zod").ZodNullable<import("zod").ZodOptional<import("zod").ZodNumber>>>;
                        prefix: import("zod").ZodOptional<import("zod").ZodString>;
                        remaining: import("zod").ZodDefault<import("zod").ZodNullable<import("zod").ZodOptional<import("zod").ZodNumber>>>;
                        metadata: import("zod").ZodOptional<import("zod").ZodAny>;
                        refillAmount: import("zod").ZodOptional<import("zod").ZodNumber>;
                        refillInterval: import("zod").ZodOptional<import("zod").ZodNumber>;
                        rateLimitTimeWindow: import("zod").ZodOptional<import("zod").ZodNumber>;
                        rateLimitMax: import("zod").ZodOptional<import("zod").ZodNumber>;
                        rateLimitEnabled: import("zod").ZodOptional<import("zod").ZodBoolean>;
                        permissions: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>>>;
                        userId: import("zod").ZodOptional<import("zod").ZodCoercedString<unknown>>;
                        organizationId: import("zod").ZodOptional<import("zod").ZodCoercedString<unknown>>;
                    }, import("zod/v4/core").$strip>;
                    metadata: {
                        openapi: {
                            description: string;
                            responses: {
                                "200": {
                                    description: string;
                                    content: {
                                        "application/json": {
                                            schema: {
                                                type: "object";
                                                properties: {
                                                    id: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    createdAt: {
                                                        type: string;
                                                        format: string;
                                                        description: string;
                                                    };
                                                    updatedAt: {
                                                        type: string;
                                                        format: string;
                                                        description: string;
                                                    };
                                                    name: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    prefix: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    start: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    key: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    enabled: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    expiresAt: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    referenceId: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    lastRefillAt: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    lastRequest: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    metadata: {
                                                        type: string;
                                                        nullable: boolean;
                                                        additionalProperties: boolean;
                                                        description: string;
                                                    };
                                                    rateLimitMax: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    rateLimitTimeWindow: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    remaining: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    refillAmount: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    refillInterval: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    rateLimitEnabled: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    requestCount: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    permissions: {
                                                        type: string;
                                                        nullable: boolean;
                                                        additionalProperties: {
                                                            type: string;
                                                            items: {
                                                                type: string;
                                                            };
                                                        };
                                                        description: string;
                                                    };
                                                };
                                                required: string[];
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                path: "/api-key/create";
            };
            verifyApiKey: {
                (context: {
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    asResponse: true;
                }): Promise<Response>;
                (context: {
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: true;
                }): Promise<{
                    headers: Headers;
                    status: number;
                    response: {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "KEY_NOT_FOUND";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: string | undefined;
                            code: string;
                            cause?: unknown;
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "INVALID_API_KEY";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: null;
                        key: Omit<import("@better-auth/api-key").ApiKey, "key"> | null;
                    };
                }>;
                (context: {
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: false;
                }): Promise<{
                    headers: Headers;
                    response: {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "KEY_NOT_FOUND";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: string | undefined;
                            code: string;
                            cause?: unknown;
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "INVALID_API_KEY";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: null;
                        key: Omit<import("@better-auth/api-key").ApiKey, "key"> | null;
                    };
                }>;
                (context: {
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "KEY_NOT_FOUND";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: string | undefined;
                            code: string;
                            cause?: unknown;
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "INVALID_API_KEY";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: null;
                        key: Omit<import("@better-auth/api-key").ApiKey, "key"> | null;
                    };
                }>;
                (context: {
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: false;
                }): Promise<{
                    valid: boolean;
                    error: {
                        message: import("better-auth").RawError<"INVALID_API_KEY">;
                        code: "KEY_NOT_FOUND";
                    };
                    key: null;
                } | {
                    valid: boolean;
                    error: {
                        message: string | undefined;
                        code: string;
                        cause?: unknown;
                    };
                    key: null;
                } | {
                    valid: boolean;
                    error: {
                        message: import("better-auth").RawError<"INVALID_API_KEY">;
                        code: "INVALID_API_KEY";
                    };
                    key: null;
                } | {
                    valid: boolean;
                    error: null;
                    key: Omit<import("@better-auth/api-key").ApiKey, "key"> | null;
                }>;
                (context: {
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                }): Promise<{
                    headers: Headers;
                    response: {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "KEY_NOT_FOUND";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: string | undefined;
                            code: string;
                            cause?: unknown;
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "INVALID_API_KEY";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: null;
                        key: Omit<import("@better-auth/api-key").ApiKey, "key"> | null;
                    };
                }>;
                (context: {
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "KEY_NOT_FOUND";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: string | undefined;
                            code: string;
                            cause?: unknown;
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: {
                            message: import("better-auth").RawError<"INVALID_API_KEY">;
                            code: "INVALID_API_KEY";
                        };
                        key: null;
                    } | {
                        valid: boolean;
                        error: null;
                        key: Omit<import("@better-auth/api-key").ApiKey, "key"> | null;
                    };
                }>;
                (context?: ({
                    body: {
                        key: string;
                        configId?: string | undefined;
                        permissions?: Record<string, string[]> | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                }) | undefined): Promise<{
                    valid: boolean;
                    error: {
                        message: import("better-auth").RawError<"INVALID_API_KEY">;
                        code: "KEY_NOT_FOUND";
                    };
                    key: null;
                } | {
                    valid: boolean;
                    error: {
                        message: string | undefined;
                        code: string;
                        cause?: unknown;
                    };
                    key: null;
                } | {
                    valid: boolean;
                    error: {
                        message: import("better-auth").RawError<"INVALID_API_KEY">;
                        code: "INVALID_API_KEY";
                    };
                    key: null;
                } | {
                    valid: boolean;
                    error: null;
                    key: Omit<import("@better-auth/api-key").ApiKey, "key"> | null;
                }>;
                options: {
                    method: "POST";
                    body: import("zod").ZodObject<{
                        configId: import("zod").ZodOptional<import("zod").ZodString>;
                        key: import("zod").ZodString;
                        permissions: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>>>;
                    }, import("zod/v4/core").$strip>;
                };
                path: string;
            };
            getApiKey: {
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    asResponse: true;
                }): Promise<Response>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: true;
                }): Promise<{
                    headers: Headers;
                    status: number;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: false;
                }): Promise<{
                    headers: Headers;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: false;
                }): Promise<{
                    metadata: Record<string, any> | null;
                    permissions: {
                        [key: string]: string[];
                    } | null;
                    id: string;
                    configId: string;
                    name: string | null;
                    start: string | null;
                    prefix: string | null;
                    referenceId: string;
                    refillInterval: number | null;
                    refillAmount: number | null;
                    lastRefillAt: Date | null;
                    enabled: boolean;
                    rateLimitEnabled: boolean;
                    rateLimitTimeWindow: number | null;
                    rateLimitMax: number | null;
                    requestCount: number;
                    remaining: number | null;
                    lastRequest: Date | null;
                    expiresAt: Date | null;
                    createdAt: Date;
                    updatedAt: Date;
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                }): Promise<{
                    headers: Headers;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context?: ({
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query: {
                        id: string;
                        configId?: string | undefined;
                    };
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                }) | undefined): Promise<{
                    metadata: Record<string, any> | null;
                    permissions: {
                        [key: string]: string[];
                    } | null;
                    id: string;
                    configId: string;
                    name: string | null;
                    start: string | null;
                    prefix: string | null;
                    referenceId: string;
                    refillInterval: number | null;
                    refillAmount: number | null;
                    lastRefillAt: Date | null;
                    enabled: boolean;
                    rateLimitEnabled: boolean;
                    rateLimitTimeWindow: number | null;
                    rateLimitMax: number | null;
                    requestCount: number;
                    remaining: number | null;
                    lastRequest: Date | null;
                    expiresAt: Date | null;
                    createdAt: Date;
                    updatedAt: Date;
                }>;
                options: {
                    method: "GET";
                    query: import("zod").ZodObject<{
                        configId: import("zod").ZodOptional<import("zod").ZodString>;
                        id: import("zod").ZodString;
                    }, import("zod/v4/core").$strip>;
                    use: ((inputContext: {
                        body?: undefined;
                    } & {
                        query?: Record<string, any> | undefined;
                    } & {
                        request?: Request;
                    } & {
                        headers?: HeadersInit;
                    } & {
                        asResponse?: boolean;
                        returnHeaders?: boolean;
                        use?: any[];
                    }) => Promise<{
                        session: {
                            session: Record<string, any> & {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                userId: string;
                                expiresAt: Date;
                                token: string;
                                ipAddress?: string | null | undefined;
                                userAgent?: string | null | undefined;
                            };
                            user: Record<string, any> & {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                email: string;
                                emailVerified: boolean;
                                name: string;
                                image?: string | null | undefined;
                            };
                        };
                    }>)[];
                    metadata: {
                        openapi: {
                            description: string;
                            responses: {
                                "200": {
                                    description: string;
                                    content: {
                                        "application/json": {
                                            schema: {
                                                type: "object";
                                                properties: {
                                                    id: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    name: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    start: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    prefix: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    userId: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    refillInterval: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    refillAmount: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    lastRefillAt: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    enabled: {
                                                        type: string;
                                                        description: string;
                                                        default: boolean;
                                                    };
                                                    rateLimitEnabled: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    rateLimitTimeWindow: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    rateLimitMax: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    requestCount: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    remaining: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    lastRequest: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    expiresAt: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    createdAt: {
                                                        type: string;
                                                        format: string;
                                                        description: string;
                                                    };
                                                    updatedAt: {
                                                        type: string;
                                                        format: string;
                                                        description: string;
                                                    };
                                                    metadata: {
                                                        type: string;
                                                        nullable: boolean;
                                                        additionalProperties: boolean;
                                                        description: string;
                                                    };
                                                    permissions: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                };
                                                required: string[];
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                path: "/api-key/get";
            };
            updateApiKey: {
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    asResponse: true;
                }): Promise<Response>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: true;
                }): Promise<{
                    headers: Headers;
                    status: number;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: false;
                }): Promise<{
                    headers: Headers;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: false;
                }): Promise<{
                    metadata: Record<string, any> | null;
                    permissions: {
                        [key: string]: string[];
                    } | null;
                    id: string;
                    configId: string;
                    name: string | null;
                    start: string | null;
                    prefix: string | null;
                    referenceId: string;
                    refillInterval: number | null;
                    refillAmount: number | null;
                    lastRefillAt: Date | null;
                    enabled: boolean;
                    rateLimitEnabled: boolean;
                    rateLimitTimeWindow: number | null;
                    rateLimitMax: number | null;
                    requestCount: number;
                    remaining: number | null;
                    lastRequest: Date | null;
                    expiresAt: Date | null;
                    createdAt: Date;
                    updatedAt: Date;
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                }): Promise<{
                    headers: Headers;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                }>;
                (context?: ({
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                        userId?: unknown;
                        name?: string | undefined;
                        enabled?: boolean | undefined;
                        remaining?: number | undefined;
                        refillAmount?: number | undefined;
                        refillInterval?: number | undefined;
                        metadata?: any;
                        expiresIn?: number | null | undefined;
                        rateLimitEnabled?: boolean | undefined;
                        rateLimitTimeWindow?: number | undefined;
                        rateLimitMax?: number | undefined;
                        permissions?: Record<string, string[]> | null | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                }) | undefined): Promise<{
                    metadata: Record<string, any> | null;
                    permissions: {
                        [key: string]: string[];
                    } | null;
                    id: string;
                    configId: string;
                    name: string | null;
                    start: string | null;
                    prefix: string | null;
                    referenceId: string;
                    refillInterval: number | null;
                    refillAmount: number | null;
                    lastRefillAt: Date | null;
                    enabled: boolean;
                    rateLimitEnabled: boolean;
                    rateLimitTimeWindow: number | null;
                    rateLimitMax: number | null;
                    requestCount: number;
                    remaining: number | null;
                    lastRequest: Date | null;
                    expiresAt: Date | null;
                    createdAt: Date;
                    updatedAt: Date;
                }>;
                options: {
                    method: "POST";
                    body: import("zod").ZodObject<{
                        configId: import("zod").ZodOptional<import("zod").ZodString>;
                        keyId: import("zod").ZodString;
                        userId: import("zod").ZodOptional<import("zod").ZodCoercedString<unknown>>;
                        name: import("zod").ZodOptional<import("zod").ZodString>;
                        enabled: import("zod").ZodOptional<import("zod").ZodBoolean>;
                        remaining: import("zod").ZodOptional<import("zod").ZodNumber>;
                        refillAmount: import("zod").ZodOptional<import("zod").ZodNumber>;
                        refillInterval: import("zod").ZodOptional<import("zod").ZodNumber>;
                        metadata: import("zod").ZodOptional<import("zod").ZodAny>;
                        expiresIn: import("zod").ZodNullable<import("zod").ZodOptional<import("zod").ZodNumber>>;
                        rateLimitEnabled: import("zod").ZodOptional<import("zod").ZodBoolean>;
                        rateLimitTimeWindow: import("zod").ZodOptional<import("zod").ZodNumber>;
                        rateLimitMax: import("zod").ZodOptional<import("zod").ZodNumber>;
                        permissions: import("zod").ZodNullable<import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>>>>;
                    }, import("zod/v4/core").$strip>;
                    metadata: {
                        openapi: {
                            description: string;
                            responses: {
                                "200": {
                                    description: string;
                                    content: {
                                        "application/json": {
                                            schema: {
                                                type: "object";
                                                properties: {
                                                    id: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    name: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    start: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    prefix: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    userId: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    refillInterval: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    refillAmount: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    lastRefillAt: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    enabled: {
                                                        type: string;
                                                        description: string;
                                                        default: boolean;
                                                    };
                                                    rateLimitEnabled: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    rateLimitTimeWindow: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    rateLimitMax: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    requestCount: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    remaining: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    lastRequest: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    expiresAt: {
                                                        type: string;
                                                        format: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    createdAt: {
                                                        type: string;
                                                        format: string;
                                                        description: string;
                                                    };
                                                    updatedAt: {
                                                        type: string;
                                                        format: string;
                                                        description: string;
                                                    };
                                                    metadata: {
                                                        type: string;
                                                        nullable: boolean;
                                                        additionalProperties: boolean;
                                                        description: string;
                                                    };
                                                    permissions: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                };
                                                required: string[];
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                path: "/api-key/update";
            };
            deleteApiKey: {
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    asResponse: true;
                }): Promise<Response>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: true;
                }): Promise<{
                    headers: Headers;
                    status: number;
                    response: {
                        success: boolean;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: false;
                }): Promise<{
                    headers: Headers;
                    response: {
                        success: boolean;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        success: boolean;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: false;
                }): Promise<{
                    success: boolean;
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                }): Promise<{
                    headers: Headers;
                    response: {
                        success: boolean;
                    };
                }>;
                (context: {
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        success: boolean;
                    };
                }>;
                (context?: ({
                    body: {
                        keyId: string;
                        configId?: string | undefined;
                    };
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                }) | undefined): Promise<{
                    success: boolean;
                }>;
                options: {
                    method: "POST";
                    body: import("zod").ZodObject<{
                        configId: import("zod").ZodOptional<import("zod").ZodString>;
                        keyId: import("zod").ZodString;
                    }, import("zod/v4/core").$strip>;
                    use: ((inputContext: {
                        body?: undefined;
                    } & {
                        query?: Record<string, any> | undefined;
                    } & {
                        request?: Request;
                    } & {
                        headers?: HeadersInit;
                    } & {
                        asResponse?: boolean;
                        returnHeaders?: boolean;
                        use?: any[];
                    }) => Promise<{
                        session: {
                            session: Record<string, any> & {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                userId: string;
                                expiresAt: Date;
                                token: string;
                                ipAddress?: string | null | undefined;
                                userAgent?: string | null | undefined;
                            };
                            user: Record<string, any> & {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                email: string;
                                emailVerified: boolean;
                                name: string;
                                image?: string | null | undefined;
                            };
                        };
                    }>)[];
                    metadata: {
                        openapi: {
                            description: string;
                            requestBody: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                keyId: {
                                                    type: string;
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                            responses: {
                                "200": {
                                    description: string;
                                    content: {
                                        "application/json": {
                                            schema: {
                                                type: "object";
                                                properties: {
                                                    success: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                };
                                                required: string[];
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                path: "/api-key/delete";
            };
            listApiKeys: {
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    asResponse: true;
                }): Promise<Response>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: true;
                }): Promise<{
                    headers: Headers;
                    status: number;
                    response: {
                        apiKeys: {
                            metadata: Record<string, any> | null;
                            permissions: {
                                [key: string]: string[];
                            } | null;
                            id: string;
                            configId: string;
                            name: string | null;
                            start: string | null;
                            prefix: string | null;
                            referenceId: string;
                            refillInterval: number | null;
                            refillAmount: number | null;
                            lastRefillAt: Date | null;
                            enabled: boolean;
                            rateLimitEnabled: boolean;
                            rateLimitTimeWindow: number | null;
                            rateLimitMax: number | null;
                            requestCount: number;
                            remaining: number | null;
                            lastRequest: Date | null;
                            expiresAt: Date | null;
                            createdAt: Date;
                            updatedAt: Date;
                        }[];
                        total: number;
                        limit: number | undefined;
                        offset: number | undefined;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: false;
                }): Promise<{
                    headers: Headers;
                    response: {
                        apiKeys: {
                            metadata: Record<string, any> | null;
                            permissions: {
                                [key: string]: string[];
                            } | null;
                            id: string;
                            configId: string;
                            name: string | null;
                            start: string | null;
                            prefix: string | null;
                            referenceId: string;
                            refillInterval: number | null;
                            refillAmount: number | null;
                            lastRefillAt: Date | null;
                            enabled: boolean;
                            rateLimitEnabled: boolean;
                            rateLimitTimeWindow: number | null;
                            rateLimitMax: number | null;
                            requestCount: number;
                            remaining: number | null;
                            lastRequest: Date | null;
                            expiresAt: Date | null;
                            createdAt: Date;
                            updatedAt: Date;
                        }[];
                        total: number;
                        limit: number | undefined;
                        offset: number | undefined;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        apiKeys: {
                            metadata: Record<string, any> | null;
                            permissions: {
                                [key: string]: string[];
                            } | null;
                            id: string;
                            configId: string;
                            name: string | null;
                            start: string | null;
                            prefix: string | null;
                            referenceId: string;
                            refillInterval: number | null;
                            refillAmount: number | null;
                            lastRefillAt: Date | null;
                            enabled: boolean;
                            rateLimitEnabled: boolean;
                            rateLimitTimeWindow: number | null;
                            rateLimitMax: number | null;
                            requestCount: number;
                            remaining: number | null;
                            lastRequest: Date | null;
                            expiresAt: Date | null;
                            createdAt: Date;
                            updatedAt: Date;
                        }[];
                        total: number;
                        limit: number | undefined;
                        offset: number | undefined;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: false;
                }): Promise<{
                    apiKeys: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    }[];
                    total: number;
                    limit: number | undefined;
                    offset: number | undefined;
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                }): Promise<{
                    headers: Headers;
                    response: {
                        apiKeys: {
                            metadata: Record<string, any> | null;
                            permissions: {
                                [key: string]: string[];
                            } | null;
                            id: string;
                            configId: string;
                            name: string | null;
                            start: string | null;
                            prefix: string | null;
                            referenceId: string;
                            refillInterval: number | null;
                            refillAmount: number | null;
                            lastRefillAt: Date | null;
                            enabled: boolean;
                            rateLimitEnabled: boolean;
                            rateLimitTimeWindow: number | null;
                            rateLimitMax: number | null;
                            requestCount: number;
                            remaining: number | null;
                            lastRequest: Date | null;
                            expiresAt: Date | null;
                            createdAt: Date;
                            updatedAt: Date;
                        }[];
                        total: number;
                        limit: number | undefined;
                        offset: number | undefined;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        apiKeys: {
                            metadata: Record<string, any> | null;
                            permissions: {
                                [key: string]: string[];
                            } | null;
                            id: string;
                            configId: string;
                            name: string | null;
                            start: string | null;
                            prefix: string | null;
                            referenceId: string;
                            refillInterval: number | null;
                            refillAmount: number | null;
                            lastRefillAt: Date | null;
                            enabled: boolean;
                            rateLimitEnabled: boolean;
                            rateLimitTimeWindow: number | null;
                            rateLimitMax: number | null;
                            requestCount: number;
                            remaining: number | null;
                            lastRequest: Date | null;
                            expiresAt: Date | null;
                            createdAt: Date;
                            updatedAt: Date;
                        }[];
                        total: number;
                        limit: number | undefined;
                        offset: number | undefined;
                    };
                }>;
                (context?: ({
                    body?: undefined;
                } & {
                    method?: "GET" | undefined;
                } & {
                    query?: {
                        configId?: string | undefined;
                        organizationId?: string | undefined;
                        limit?: unknown;
                        offset?: unknown;
                        sortBy?: string | undefined;
                        sortDirection?: "asc" | "desc" | undefined;
                    } | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                }) | undefined): Promise<{
                    apiKeys: {
                        metadata: Record<string, any> | null;
                        permissions: {
                            [key: string]: string[];
                        } | null;
                        id: string;
                        configId: string;
                        name: string | null;
                        start: string | null;
                        prefix: string | null;
                        referenceId: string;
                        refillInterval: number | null;
                        refillAmount: number | null;
                        lastRefillAt: Date | null;
                        enabled: boolean;
                        rateLimitEnabled: boolean;
                        rateLimitTimeWindow: number | null;
                        rateLimitMax: number | null;
                        requestCount: number;
                        remaining: number | null;
                        lastRequest: Date | null;
                        expiresAt: Date | null;
                        createdAt: Date;
                        updatedAt: Date;
                    }[];
                    total: number;
                    limit: number | undefined;
                    offset: number | undefined;
                }>;
                options: {
                    method: "GET";
                    use: ((inputContext: {
                        body?: undefined;
                    } & {
                        query?: Record<string, any> | undefined;
                    } & {
                        request?: Request;
                    } & {
                        headers?: HeadersInit;
                    } & {
                        asResponse?: boolean;
                        returnHeaders?: boolean;
                        use?: any[];
                    }) => Promise<{
                        session: {
                            session: Record<string, any> & {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                userId: string;
                                expiresAt: Date;
                                token: string;
                                ipAddress?: string | null | undefined;
                                userAgent?: string | null | undefined;
                            };
                            user: Record<string, any> & {
                                id: string;
                                createdAt: Date;
                                updatedAt: Date;
                                email: string;
                                emailVerified: boolean;
                                name: string;
                                image?: string | null | undefined;
                            };
                        };
                    }>)[];
                    query: import("zod").ZodOptional<import("zod").ZodObject<{
                        configId: import("zod").ZodOptional<import("zod").ZodString>;
                        organizationId: import("zod").ZodOptional<import("zod").ZodString>;
                        limit: import("zod").ZodOptional<import("zod").ZodCoercedNumber<unknown>>;
                        offset: import("zod").ZodOptional<import("zod").ZodCoercedNumber<unknown>>;
                        sortBy: import("zod").ZodOptional<import("zod").ZodString>;
                        sortDirection: import("zod").ZodOptional<import("zod").ZodEnum<{
                            asc: "asc";
                            desc: "desc";
                        }>>;
                    }, import("zod/v4/core").$strip>>;
                    metadata: {
                        openapi: {
                            description: string;
                            responses: {
                                "200": {
                                    description: string;
                                    content: {
                                        "application/json": {
                                            schema: {
                                                type: "object";
                                                properties: {
                                                    apiKeys: {
                                                        type: string;
                                                        items: {
                                                            type: string;
                                                            properties: {
                                                                id: {
                                                                    type: string;
                                                                    description: string;
                                                                };
                                                                name: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                start: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                prefix: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                userId: {
                                                                    type: string;
                                                                    description: string;
                                                                };
                                                                refillInterval: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                refillAmount: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                lastRefillAt: {
                                                                    type: string;
                                                                    format: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                enabled: {
                                                                    type: string;
                                                                    description: string;
                                                                    default: boolean;
                                                                };
                                                                rateLimitEnabled: {
                                                                    type: string;
                                                                    description: string;
                                                                };
                                                                rateLimitTimeWindow: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                rateLimitMax: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                requestCount: {
                                                                    type: string;
                                                                    description: string;
                                                                };
                                                                remaining: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                lastRequest: {
                                                                    type: string;
                                                                    format: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                expiresAt: {
                                                                    type: string;
                                                                    format: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                                createdAt: {
                                                                    type: string;
                                                                    format: string;
                                                                    description: string;
                                                                };
                                                                updatedAt: {
                                                                    type: string;
                                                                    format: string;
                                                                    description: string;
                                                                };
                                                                metadata: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    additionalProperties: boolean;
                                                                    description: string;
                                                                };
                                                                permissions: {
                                                                    type: string;
                                                                    nullable: boolean;
                                                                    description: string;
                                                                };
                                                            };
                                                            required: string[];
                                                        };
                                                    };
                                                    total: {
                                                        type: string;
                                                        description: string;
                                                    };
                                                    limit: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                    offset: {
                                                        type: string;
                                                        nullable: boolean;
                                                        description: string;
                                                    };
                                                };
                                                required: string[];
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                path: "/api-key/list";
            };
            deleteAllExpiredApiKeys: {
                (context: {
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    asResponse: true;
                }): Promise<Response>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: true;
                }): Promise<{
                    headers: Headers;
                    status: number;
                    response: {
                        success: boolean;
                        error: unknown;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                    returnStatus: false;
                }): Promise<{
                    headers: Headers;
                    response: {
                        success: boolean;
                        error: unknown;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        success: boolean;
                        error: unknown;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: false;
                    returnStatus: false;
                }): Promise<{
                    success: boolean;
                    error: unknown;
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnHeaders: true;
                }): Promise<{
                    headers: Headers;
                    response: {
                        success: boolean;
                        error: unknown;
                    };
                }>;
                (context: {
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                } & {
                    returnStatus: true;
                }): Promise<{
                    status: number;
                    response: {
                        success: boolean;
                        error: unknown;
                    };
                }>;
                (context?: ({
                    body?: undefined;
                } & {
                    method?: "POST" | undefined;
                } & {
                    query?: Record<string, any> | undefined;
                } & {
                    params?: Record<string, any>;
                } & {
                    request?: Request;
                } & {
                    headers?: HeadersInit;
                } & {
                    asResponse?: boolean;
                    returnHeaders?: boolean;
                    returnStatus?: boolean;
                    use?: any[];
                    path?: string;
                    context?: Record<string, any>;
                }) | undefined): Promise<{
                    success: boolean;
                    error: unknown;
                }>;
                options: {
                    method: "POST";
                };
                path: string;
            };
        };
        schema: {
            apikey: {
                fields: {
                    configId: {
                        type: "string";
                        required: true;
                        defaultValue: string;
                        input: false;
                        index: true;
                    };
                    name: {
                        type: "string";
                        required: false;
                        input: false;
                    };
                    start: {
                        type: "string";
                        required: false;
                        input: false;
                    };
                    referenceId: {
                        type: "string";
                        required: true;
                        input: false;
                        index: true;
                    };
                    prefix: {
                        type: "string";
                        required: false;
                        input: false;
                    };
                    key: {
                        type: "string";
                        required: true;
                        input: false;
                        index: true;
                    };
                    refillInterval: {
                        type: "number";
                        required: false;
                        input: false;
                    };
                    refillAmount: {
                        type: "number";
                        required: false;
                        input: false;
                    };
                    lastRefillAt: {
                        type: "date";
                        required: false;
                        input: false;
                    };
                    enabled: {
                        type: "boolean";
                        required: false;
                        input: false;
                        defaultValue: true;
                    };
                    rateLimitEnabled: {
                        type: "boolean";
                        required: false;
                        input: false;
                        defaultValue: true;
                    };
                    rateLimitTimeWindow: {
                        type: "number";
                        required: false;
                        input: false;
                        defaultValue: number;
                    };
                    rateLimitMax: {
                        type: "number";
                        required: false;
                        input: false;
                        defaultValue: number;
                    };
                    requestCount: {
                        type: "number";
                        required: false;
                        input: false;
                        defaultValue: number;
                    };
                    remaining: {
                        type: "number";
                        required: false;
                        input: false;
                    };
                    lastRequest: {
                        type: "date";
                        required: false;
                        input: false;
                    };
                    expiresAt: {
                        type: "date";
                        required: false;
                        input: false;
                    };
                    createdAt: {
                        type: "date";
                        required: true;
                        input: false;
                    };
                    updatedAt: {
                        type: "date";
                        required: true;
                        input: false;
                    };
                    permissions: {
                        type: "string";
                        required: false;
                        input: false;
                    };
                    metadata: {
                        type: "string";
                        required: false;
                        input: true;
                        transform: {
                            input(value: import("better-auth").DBPrimitive): string;
                            output(value: import("better-auth").DBPrimitive): any;
                        };
                    };
                };
            };
        };
    }];
    emailAndPassword: {
        enabled: true;
        requireEmailVerification: true;
        sendResetPassword: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }, _request: Request | undefined) => Promise<void>;
    };
    emailVerification: {
        sendVerificationEmail: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }, _request: Request | undefined) => Promise<void>;
        sendOnSignUp: true;
        sendOnSignIn: true;
        autoSignInAfterVerification: true;
        afterEmailVerification(user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
        }, _request: Request | undefined): Promise<void>;
    };
    databaseHooks: {
        user: {
            create: {
                after: (user: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                } & Record<string, unknown>) => Promise<void>;
            };
        };
    };
    account: {
        accountLinking: {
            enabled: true;
            trustedProviders: ("email-password" | "siwn")[];
            allowDifferentEmails: true;
            updateUserInfoOnLink: true;
        };
    };
    session: {
        cookieCache: {
            enabled: boolean;
            maxAge: number;
        };
    };
    advanced: {
        defaultCookieAttributes: {
            sameSite: "lax";
            secure: boolean;
            httpOnly: true;
        };
    };
}>;
export type Auth = ReturnType<typeof createAuthInstance>;
export type AuthSession = Auth["$Infer"]["Session"];
