import { Effect } from "every-plugin/effect";
import { createServerClient, type AuthenticatedClient, parseKey } from "better-near-auth/server";

export interface FederatedServiceConfig {
  serverName: string;
  accountId: string;
  privateKey: string;
  networkId: "mainnet" | "testnet";
  targetServerUrl?: string;
  targetRecipient?: string;
}

export class FederatedService {
  private serverName: string;
  private accountId: string;
  private privateKey: string;
  private networkId: "mainnet" | "testnet";
  private targetServerUrl?: string;
  private targetRecipient?: string;
  private targetClient: AuthenticatedClient | null = null;

  constructor(config: FederatedServiceConfig) {
    this.serverName = config.serverName;
    this.accountId = config.accountId;
    this.privateKey = config.privateKey;
    this.networkId = config.networkId;
    this.targetServerUrl = config.targetServerUrl;
    this.targetRecipient = config.targetRecipient;
  }

  ping() {
    return Effect.succeed({
      status: "ok" as const,
      server: this.serverName,
      accountId: this.accountId,
      timestamp: new Date().toISOString(),
    });
  }

  getIdentity() {
    const keyPair = parseKey(this.privateKey);
    return Effect.succeed({
      accountId: this.accountId,
      publicKey: keyPair.publicKey.toString(),
      networkId: this.networkId,
    });
  }

  callTarget(endpoint: string) {
    return Effect.tryPromise({
      try: async () => {
        if (!this.targetServerUrl || !this.targetRecipient) {
          throw new Error("Target server not configured");
        }

        if (!this.targetClient) {
          this.targetClient = await createServerClient({
            accountId: this.accountId,
            privateKey: this.privateKey,
            targetServerUrl: this.targetServerUrl,
            recipient: this.targetRecipient,
            networkId: this.networkId,
          });
          console.log(`[${this.serverName}] Authenticated to target server as ${this.accountId}`);
        }

        const response = await this.targetClient.fetch(endpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Target server responded with ${response.status}`);
        }

        const data = await response.json();

        return {
          calledFrom: this.serverName,
          targetResponse: data,
        };
      },
      catch: (error: unknown) =>
        new Error(`Failed to call target: ${error instanceof Error ? error.message : String(error)}`),
    });
  }
}
