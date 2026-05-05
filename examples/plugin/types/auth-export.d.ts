export type { Auth, AuthSession, createAuthInstance } from "./auth-instance";
export interface AuthServices {
    auth: import("./auth-instance").Auth;
    db: import("./db/layer").AuthDatabase;
    handler: (req: Request) => Promise<Response>;
}
