import { WalletManifest, SignMessageParams, SignedMessage, SignAndSendTransactionParams, SignAndSendTransactionsParams, SignDelegateActionsParams } from '@fastnear/near-connect';
export { SignDelegateActionsParams, SignedMessage, WalletManifest } from '@fastnear/near-connect';
import { SignDelegateActionsResponse } from '@fastnear/near-connect/build/types';
export { SignDelegateActionResult, SignDelegateActionsResponse } from '@fastnear/near-connect/build/types';

type Network = "mainnet" | "testnet";
interface ConnectOptions {
    network?: Network;
    contractId?: string;
    methodNames?: string[];
    excludedWallets?: string[];
    features?: Record<string, boolean>;
    manifest?: string | {
        wallets: WalletManifest[];
        version: string;
    };
    walletConnect?: {
        projectId: string;
        metadata?: {
            name?: string;
            description?: string;
            url?: string;
            icons?: string[];
        };
    };
    footerBranding?: {
        heading?: string;
        link?: string;
        linkText?: string;
        icon?: string;
    } | null;
    signMessageParams?: Omit<SignMessageParams, "signerId" | "network">;
}
interface ConnectResult {
    accountId: string;
    publicKey?: string;
    network?: Network;
    signedMessage?: SignedMessage;
}
type ConnectCallback = (result: ConnectResult) => void;
type DisconnectCallback = (info?: {
    network: Network;
}) => void;
/**
 * Restore a previously connected wallet session.
 * Call this on page load to re-hydrate state from storage.
 *
 * Pass `{ network }` to restore a specific network's session — useful for
 * pages that want to attempt parallel mainnet+testnet restores. Without it,
 * the active network (default `mainnet`) is used.
 */
declare function restore(options?: ConnectOptions): Promise<ConnectResult | null>;
/**
 * Show the wallet picker popup without signing in.
 * Returns the selected wallet ID string.
 */
declare function selectWallet(options?: ConnectOptions & {
    features?: Partial<Record<string, boolean>>;
}): Promise<string>;
/**
 * Return the list of available wallet manifests so apps can build custom UI.
 */
declare function availableWallets(options?: ConnectOptions): Promise<WalletManifest[]>;
/**
 * Register a debug wallet for developer tooling.
 */
declare function registerDebugWallet(manifest: string | WalletManifest, options?: ConnectOptions): Promise<WalletManifest>;
/**
 * Remove a previously registered debug wallet.
 */
declare function removeDebugWallet(id: string, options?: ConnectOptions): Promise<void>;
/**
 * Add a per-contract function-call access key to the signed-in account.
 *
 * Generates a keypair locally inside the wallet executor, sends an `AddKey`
 * transaction through the wallet (one popup), and stores the private key
 * locally so subsequent zero-deposit function calls to `contractId` can be
 * signed silently.
 *
 * Use this to grant zero-popup signing to a contract that was *not* the one
 * passed to `connect({ contractId })` at sign-in time. For example, if your
 * page signs in for one contract but also wants silent draws on another,
 * call this after `onConnect` fires.
 *
 * Routes to the per-network session matching `params.network` (or the active
 * network when omitted). Requires a connected wallet on that network.
 */
declare function addFunctionCallKey(params: {
    contractId: string;
    methodNames?: string[];
    allowance?: string;
    network?: Network;
    signerId?: string;
}): Promise<{
    publicKey: string;
    transactionOutcome: any;
}>;
/**
 * Switch the connector to a different network.
 *
 * Note: with per-network state this is no longer required for typical use —
 * just call `connect({ network })` / `restore({ network })` / `accountId({ network })`
 * directly. Kept for backwards compatibility; uses the connector for the
 * active network (or the network in `signInData.network` if provided).
 */
declare function switchNetwork(network: Network, signInData?: {
    contractId?: string;
    methodNames?: string[];
}): Promise<void>;
/**
 * Show the wallet picker popup and connect.
 * Returns the connected account info.
 * If walletId is provided, connects directly to that wallet without showing the picker.
 *
 * Pass `{ network: "testnet" }` to connect on testnet without affecting an
 * existing mainnet session.
 */
declare function connect(options?: ConnectOptions & {
    walletId?: string;
}): Promise<ConnectResult | null>;
/**
 * Disconnect a wallet session. Without arguments, disconnects the active
 * network's session. Pass `{ network }` to disconnect a specific network.
 */
declare function disconnect(options?: {
    network?: Network;
}): Promise<void>;
/**
 * Sign and send a single transaction via the connected wallet.
 * Accepts both fastnear-style flat actions and @hot-labs/near-connect ConnectorActions.
 *
 * Routes to the per-network session matching `params.network` if specified
 * (or `activeNetwork` otherwise).
 */
declare function sendTransaction(params: (SignAndSendTransactionParams | {
    receiverId: string;
    actions: any[];
    signerId?: string;
}) & {
    network?: Network;
}): Promise<any>;
/**
 * Sign and send multiple transactions via the connected wallet.
 * Accepts both fastnear-style flat actions and @hot-labs/near-connect ConnectorActions.
 */
declare function sendTransactions(params: (SignAndSendTransactionsParams | {
    transactions: Array<{
        receiverId: string;
        actions: any[];
    }>;
    signerId?: string;
}) & {
    network?: Network;
}): Promise<any>;
/**
 * Sign a message (NEP-413) via the connected wallet.
 */
declare function signMessage(params: SignMessageParams & {
    network?: Network;
}): Promise<any>;
/**
 * Sign delegate actions (NEP-366) via the connected wallet.
 * Accepts both fastnear-style flat actions and ConnectorActions.
 */
declare function signDelegateActions(params: SignDelegateActionsParams & {
    network?: Network;
}): Promise<SignDelegateActionsResponse>;
/**
 * Get the connected account id for a specific network (or the active one).
 */
declare function accountId(opts?: {
    network?: Network;
}): string | null;
/**
 * Check whether a wallet is currently connected for a specific network
 * (or the active one).
 */
declare function isConnected(opts?: {
    network?: Network;
}): boolean;
/**
 * Get the name of the connected wallet (e.g. "MyNearWallet") for a given
 * network or the active one.
 */
declare function walletName(opts?: {
    network?: Network;
}): string | null;
/**
 * Destroy the connector(s) so the next connect()/restore() creates fresh ones
 * with fresh options. Pass `{ network }` to reset only one network's state;
 * without arguments, both networks are reset.
 */
declare function reset(opts?: {
    network?: Network;
}): void;
/**
 * Register a callback for when a wallet connects.
 */
declare function onConnect(cb: ConnectCallback): void;
/**
 * Register a callback for when a wallet disconnects.
 */
declare function onDisconnect(cb: DisconnectCallback): void;

export { type ConnectOptions, type ConnectResult, accountId, addFunctionCallKey, availableWallets, connect, disconnect, isConnected, onConnect, onDisconnect, registerDebugWallet, removeDebugWallet, reset, restore, selectWallet, sendTransaction, sendTransactions, signDelegateActions, signMessage, switchNetwork, walletName };
