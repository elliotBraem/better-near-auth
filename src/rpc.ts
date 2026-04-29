type Network = "mainnet" | "testnet";

function getRpcUrl(network: Network): string {
	return network === "testnet"
		? "https://rpc.testnet.fastnear.com"
		: "https://rpc.mainnet.fastnear.com";
}

interface RpcError {
	code: number;
	message: string;
	data?: unknown;
}

interface RpcResponse<T> {
	jsonrpc: "2.0";
	id: string;
	result?: T;
	error?: RpcError;
}

async function rpcCall<T>(
	method: string,
	params: Record<string, unknown> | unknown[],
	network: Network,
	apiKey?: string,
): Promise<T> {
	const url = `${getRpcUrl(network)}${apiKey ? `?apiKey=${apiKey}` : ""}`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: "fastnear",
			method,
			params,
		}),
	});
	const data = await response.json() as RpcResponse<T>;
	if (data.error) {
		throw new Error(data.error.message || "RPC error");
	}
	if (!data.result) {
		throw new Error("Empty RPC result");
	}
	return data.result;
}

export interface AccessKeyView {
	nonce: number;
	permission: {
		functionCall?: {
			allowance?: string;
			receiverId: string;
			methodNames: string[];
		};
	} | "FullAccess";
}

export interface BlockHeaderView {
	hash: string;
	height: number;
	timestamp_nanosec: string;
}

export interface BlockView {
	header: BlockHeaderView;
}

export interface TxStatus {
	HasSuccessReceiptId?: string;
	SuccessValue?: string;
	Failure?: { error_type: string; error: string };
	HasError?: unknown;
}

export interface TxOutcome {
	gas_burnt?: string;
	tokens_burnt?: string;
	logs?: string[];
	receipt_ids?: string[];
	status: TxStatus;
}

export interface TxResultView {
	transaction: {
		hash: string;
		signer_id: string;
		receiver_id: string;
		actions: unknown[];
		outcome?: TxOutcome;
	};
	receipts_outcome?: { outcome: TxOutcome }[];
	status: TxStatus;
}

export interface AccountView {
	amount: string;
	locked?: string;
	storage_usage?: number;
	code_hash?: string;
	block_height?: number;
	block_hash?: string;
}

export function queryAccessKey(
	accountId: string,
	publicKey: string,
	network: Network,
	apiKey?: string,
): Promise<AccessKeyView> {
	const pk = publicKey.startsWith("ed25519:") ? publicKey : `ed25519:${publicKey}`;
	return rpcCall<AccessKeyView>("query", {
		request_type: "view_access_key",
		account_id: accountId,
		public_key: pk,
		finality: "final",
	}, network, apiKey);
}

export function queryBlock(
	network: Network,
	apiKey?: string,
): Promise<BlockView> {
	return rpcCall<BlockView>("block", { finality: "final" }, network, apiKey);
}

export function queryTx(
	txHash: string,
	senderId: string,
	network: Network,
	apiKey?: string,
): Promise<TxResultView> {
	return rpcCall<TxResultView>("tx", {
		tx_hash: txHash,
		sender_id: senderId,
	}, network, apiKey);
}

export function sendTxBroadcast(
	signedTxBase64: string,
	network: Network,
	apiKey?: string,
): Promise<string> {
	return rpcCall<string>(
		"broadcast_tx_async",
		[signedTxBase64],
		network,
		apiKey,
	);
}

export function queryAccount(
	accountId: string,
	network: Network,
	apiKey?: string,
): Promise<AccountView> {
	return rpcCall<AccountView>("query", {
		request_type: "view_account",
		account_id: accountId,
		finality: "final",
	}, network, apiKey);
}

interface ViewFunctionResult {
	result: number[];
	logs: string[];
}

export function viewFunction(
	contractId: string,
	methodName: string,
	args: Record<string, unknown>,
	network: Network,
	apiKey?: string,
): Promise<string> {
	const argsBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(args))));
	return rpcCall<ViewFunctionResult>("query", {
		request_type: "call_function",
		account_id: contractId,
		method_name: methodName,
		args_base64: argsBase64,
		finality: "final",
	}, network, apiKey).then(result => {
		if (result.result && Array.isArray(result.result)) {
			return JSON.parse(new TextDecoder().decode(Uint8Array.from(result.result)));
		}
		return "";
	});
}
