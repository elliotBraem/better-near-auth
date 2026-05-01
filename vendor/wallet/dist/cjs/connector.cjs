/* ⋈ 🏃🏻💨 FastNear Wallet Connector - CJS (@fastnear/wallet version 1.2.0) */
/* https://www.npmjs.com/package/@fastnear/wallet/v/1.2.0 */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var connector_exports = {};
__export(connector_exports, {
  accountId: () => accountId,
  addFunctionCallKey: () => addFunctionCallKey,
  availableWallets: () => availableWallets,
  connect: () => connect,
  connectedNetworks: () => connectedNetworks,
  disconnect: () => disconnect,
  getActiveNetwork: () => getActiveNetwork,
  isConnected: () => isConnected,
  onConnect: () => onConnect,
  onDisconnect: () => onDisconnect,
  registerDebugWallet: () => registerDebugWallet,
  removeDebugWallet: () => removeDebugWallet,
  reset: () => reset,
  restore: () => restore,
  selectWallet: () => selectWallet,
  sendTransaction: () => sendTransaction,
  sendTransactions: () => sendTransactions,
  signDelegateActions: () => signDelegateActions,
  signMessage: () => signMessage,
  switchNetwork: () => switchNetwork,
  walletName: () => walletName
});
module.exports = __toCommonJS(connector_exports);
var import_near_connect = require("@fastnear/near-connect");
var import_borsh = require("@fastnear/borsh");
var import_borsh_schema = require("@fastnear/borsh-schema");
function toConnectorAction(action) {
  const { type, ...rest } = action;
  switch (type) {
    case "FunctionCall":
      return { type: "FunctionCall", params: { methodName: rest.methodName, args: rest.args ?? {}, gas: rest.gas ?? "30000000000000", deposit: rest.deposit ?? "0" } };
    case "Transfer":
      return { type: "Transfer", params: { deposit: rest.deposit } };
    case "Stake":
      return { type: "Stake", params: { stake: rest.stake, publicKey: rest.publicKey } };
    case "AddKey":
      return { type: "AddKey", params: { publicKey: rest.publicKey, accessKey: rest.accessKey } };
    case "DeleteKey":
      return { type: "DeleteKey", params: { publicKey: rest.publicKey } };
    case "DeleteAccount":
      return { type: "DeleteAccount", params: { beneficiaryId: rest.beneficiaryId } };
    case "CreateAccount":
      return { type: "CreateAccount" };
    case "DeployContract":
      return { type: "DeployContract", params: { code: rest.code ?? rest.codeBase64 } };
    default:
      return action;
  }
}
__name(toConnectorAction, "toConnectorAction");
function toConnectorActions(actions) {
  return actions.map(toConnectorAction);
}
__name(toConnectorActions, "toConnectorActions");
function isFastnearAction(action) {
  return action.type && !action.params && action.type !== "CreateAccount";
}
__name(isFastnearAction, "isFastnearAction");
function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
__name(base64ToBytes, "base64ToBytes");
async function sha256(data) {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}
__name(sha256, "sha256");
async function normalizeSignedDelegateAction(raw, index) {
  if (typeof raw === "string") {
    let bytes;
    try {
      bytes = base64ToBytes(raw);
    } catch {
      throw new Error(
        `Failed to base64-decode signedDelegateAction at index ${index}`
      );
    }
    let signedDelegate;
    try {
      signedDelegate = (0, import_borsh.deserialize)(import_borsh_schema.nearChainSchema.SignedDelegate, bytes);
    } catch (err) {
      throw new Error(
        `Failed to borsh-deserialize signedDelegateAction at index ${index}: ${err}`
      );
    }
    const delegateActionBytes = (0, import_borsh.serialize)(
      import_borsh_schema.nearChainSchema.DelegateAction,
      signedDelegate.delegateAction
    );
    const delegateHash = await sha256(delegateActionBytes);
    return { delegateHash, signedDelegate };
  }
  if (raw && typeof raw.signedDelegate === "string") {
    let bytes;
    try {
      bytes = base64ToBytes(raw.signedDelegate);
    } catch {
      throw new Error(
        `Failed to base64-decode signedDelegate at index ${index}`
      );
    }
    let signedDelegate;
    try {
      signedDelegate = (0, import_borsh.deserialize)(import_borsh_schema.nearChainSchema.SignedDelegate, bytes);
    } catch (err) {
      throw new Error(
        `Failed to borsh-deserialize signedDelegate at index ${index}: ${err}`
      );
    }
    let delegateHash = raw.delegateHash;
    if (!delegateHash) {
      const delegateActionBytes = (0, import_borsh.serialize)(
        import_borsh_schema.nearChainSchema.DelegateAction,
        signedDelegate.delegateAction
      );
      delegateHash = await sha256(delegateActionBytes);
    }
    return { delegateHash, signedDelegate };
  }
  return raw;
}
__name(normalizeSignedDelegateAction, "normalizeSignedDelegateAction");
const NETWORKS = ["mainnet", "testnet"];
const networkStates = {
  mainnet: { connector: null, connectedWallet: null, currentAccountId: null },
  testnet: { connector: null, connectedWallet: null, currentAccountId: null }
};
let activeNetwork = "mainnet";
const connectListeners = [];
const disconnectListeners = [];
function stateFor(network) {
  return networkStates[network ?? activeNetwork];
}
__name(stateFor, "stateFor");
function resolveNetwork(options) {
  return options?.network ?? activeNetwork;
}
__name(resolveNetwork, "resolveNetwork");
function getOrCreateConnector(options) {
  const network = resolveNetwork(options);
  const state = networkStates[network];
  if (state.connector) return state.connector;
  const opts = {
    network,
    footerBranding: options?.footerBranding ?? null
  };
  if (options?.contractId) {
    opts.signIn = {
      contractId: options.contractId,
      methodNames: options.methodNames ?? []
    };
  }
  if (options?.excludedWallets) {
    opts.excludedWallets = options.excludedWallets;
  }
  if (options?.features) {
    opts.features = options.features;
  }
  if (options?.manifest) {
    opts.manifest = options.manifest;
  }
  if (options?.walletConnect) {
    const wc = options.walletConnect;
    opts.walletConnect = {
      projectId: wc.projectId,
      metadata: {
        name: wc.metadata?.name ?? document.title ?? "NEAR dApp",
        description: wc.metadata?.description ?? "",
        url: wc.metadata?.url ?? window.location.origin,
        icons: wc.metadata?.icons ?? []
      }
    };
  }
  state.connector = new import_near_connect.NearConnector(opts);
  state.connector.on("wallet:signIn", (event) => {
    const acct = event?.accounts?.[0];
    if (!acct) return;
    state.currentAccountId = acct.accountId;
    activeNetwork = network;
    const result = {
      accountId: acct.accountId,
      publicKey: acct.publicKey,
      network
    };
    for (const cb of connectListeners) {
      try {
        cb(result);
      } catch (_) {
      }
    }
  });
  state.connector.on("wallet:signOut", () => {
    state.connectedWallet = null;
    state.currentAccountId = null;
    for (const cb of disconnectListeners) {
      try {
        cb({ network });
      } catch (_) {
      }
    }
  });
  return state.connector;
}
__name(getOrCreateConnector, "getOrCreateConnector");
async function restore(options) {
  const network = resolveNetwork(options);
  const state = networkStates[network];
  const c = getOrCreateConnector(options);
  try {
    const result = await c.getConnectedWallet();
    if (result?.wallet && result?.accounts?.length) {
      state.connectedWallet = result.wallet;
      state.currentAccountId = result.accounts[0].accountId;
      activeNetwork = network;
      const connectResult = {
        accountId: state.currentAccountId || "",
        publicKey: result.accounts[0].publicKey,
        network
      };
      for (const cb of connectListeners) {
        try {
          cb(connectResult);
        } catch (_) {
        }
      }
      return connectResult;
    }
  } catch (_) {
  }
  return null;
}
__name(restore, "restore");
async function selectWallet(options) {
  const c = getOrCreateConnector(options);
  return c.selectWallet({ features: options?.features });
}
__name(selectWallet, "selectWallet");
async function availableWallets(options) {
  const c = getOrCreateConnector(options);
  await c.whenManifestLoaded.catch(() => {
  });
  return c.availableWallets.map((w) => w.manifest);
}
__name(availableWallets, "availableWallets");
async function registerDebugWallet(manifest, options) {
  const c = getOrCreateConnector(options);
  return c.registerDebugWallet(manifest);
}
__name(registerDebugWallet, "registerDebugWallet");
async function removeDebugWallet(id, options) {
  const c = getOrCreateConnector(options);
  return c.removeDebugWallet(id);
}
__name(removeDebugWallet, "removeDebugWallet");
async function addFunctionCallKey(params) {
  const network = params.network ?? activeNetwork;
  const state = networkStates[network];
  if (!state.connectedWallet) {
    throw new Error(`No wallet connected on ${network}. Call connect({ network: "${network}" }) first.`);
  }
  const wallet = state.connectedWallet;
  if (typeof wallet.addFunctionCallKey !== "function") {
    throw new Error("Connected wallet does not support addFunctionCallKey");
  }
  const signerId = params.signerId ?? state.currentAccountId ?? void 0;
  if (!signerId) throw new Error("No signer account id available");
  return wallet.addFunctionCallKey({
    contractId: params.contractId,
    methodNames: params.methodNames ?? [],
    allowance: params.allowance,
    network,
    signerId
  });
}
__name(addFunctionCallKey, "addFunctionCallKey");
async function switchNetwork(network, signInData) {
  const state = networkStates[activeNetwork];
  if (!state.connector) throw new Error("No connector initialized. Call connect() or restore() first.");
  return state.connector.switchNetwork(network, signInData);
}
__name(switchNetwork, "switchNetwork");
async function connect(options) {
  const network = resolveNetwork(options);
  const state = networkStates[network];
  const c = getOrCreateConnector(options);
  let signedMessageResult = null;
  if (options?.signMessageParams) {
    const handler = /* @__PURE__ */ __name((event) => {
      const acct = event?.accounts?.[0];
      if (acct?.signedMessage) {
        signedMessageResult = {
          accountId: acct.signedMessage.accountId,
          publicKey: acct.signedMessage.publicKey,
          signature: acct.signedMessage.signature
        };
      }
      c.off("wallet:signInAndSignMessage", handler);
    }, "handler");
    c.on("wallet:signInAndSignMessage", handler);
  }
  let wallet;
  try {
    wallet = await c.connect({
      walletId: options?.walletId,
      signMessageParams: options?.signMessageParams
    });
  } catch (_) {
    return null;
  }
  state.connectedWallet = wallet;
  activeNetwork = network;
  let publicKey;
  if (!state.currentAccountId) {
    try {
      const info = await c.getConnectedWallet();
      if (info?.accounts?.length) {
        state.currentAccountId = info.accounts[0].accountId;
        publicKey = info.accounts[0].publicKey;
      }
    } catch (_) {
    }
  }
  return {
    accountId: state.currentAccountId ?? "",
    publicKey,
    network,
    signedMessage: signedMessageResult ?? void 0
  };
}
__name(connect, "connect");
async function disconnect(options) {
  const network = options?.network ?? activeNetwork;
  const state = networkStates[network];
  if (state.connector) {
    await state.connector.disconnect(state.connectedWallet ?? void 0);
  }
  state.connectedWallet = null;
  state.currentAccountId = null;
}
__name(disconnect, "disconnect");
async function sendTransaction(params) {
  const network = params.network ?? activeNetwork;
  const state = networkStates[network];
  if (!state.connectedWallet) {
    throw new Error(`No wallet connected on ${network}. Call connect({ network: "${network}" }) first.`);
  }
  const actions = params.actions.some(isFastnearAction) ? toConnectorActions(params.actions) : params.actions;
  return state.connectedWallet.signAndSendTransaction({
    receiverId: params.receiverId,
    actions,
    signerId: params.signerId ?? state.currentAccountId ?? void 0,
    network
  });
}
__name(sendTransaction, "sendTransaction");
async function sendTransactions(params) {
  const network = params.network ?? activeNetwork;
  const state = networkStates[network];
  if (!state.connectedWallet) {
    throw new Error(`No wallet connected on ${network}. Call connect({ network: "${network}" }) first.`);
  }
  const transactions = ("transactions" in params ? params.transactions : []).map((tx) => ({
    receiverId: tx.receiverId,
    actions: tx.actions.some(isFastnearAction) ? toConnectorActions(tx.actions) : tx.actions
  }));
  return state.connectedWallet.signAndSendTransactions({
    transactions,
    signerId: params.signerId ?? state.currentAccountId ?? void 0,
    network
  });
}
__name(sendTransactions, "sendTransactions");
async function signMessage(params) {
  const network = params.network ?? activeNetwork;
  const state = networkStates[network];
  if (!state.connectedWallet) {
    throw new Error(`No wallet connected on ${network}. Call connect({ network: "${network}" }) first.`);
  }
  return state.connectedWallet.signMessage({ ...params, network });
}
__name(signMessage, "signMessage");
async function signDelegateActions(params) {
  const network = params.network ?? activeNetwork;
  const state = networkStates[network];
  if (!state.connectedWallet) {
    throw new Error(`No wallet connected on ${network}. Call connect({ network: "${network}" }) first.`);
  }
  const wallet = state.connectedWallet;
  if (typeof wallet.signDelegateActions !== "function") {
    throw new Error("Connected wallet does not support signDelegateActions");
  }
  const delegateActions = params.delegateActions.map((da) => ({
    receiverId: da.receiverId,
    actions: da.actions.some(isFastnearAction) ? toConnectorActions(da.actions) : da.actions
  }));
  const result = await wallet.signDelegateActions({
    delegateActions,
    signerId: params.signerId ?? state.currentAccountId ?? void 0,
    network
  });
  const normalized = await Promise.all(
    result.signedDelegateActions.map(
      (raw, i) => normalizeSignedDelegateAction(raw, i)
    )
  );
  return { signedDelegateActions: normalized };
}
__name(signDelegateActions, "signDelegateActions");
function accountId(opts) {
  return stateFor(opts?.network).currentAccountId;
}
__name(accountId, "accountId");
function isConnected(opts) {
  const s = stateFor(opts?.network);
  return s.currentAccountId !== null && s.connectedWallet !== null;
}
__name(isConnected, "isConnected");
function connectedNetworks() {
  return NETWORKS.filter((n) => isConnected({ network: n }));
}
__name(connectedNetworks, "connectedNetworks");
function getActiveNetwork() {
  return activeNetwork;
}
__name(getActiveNetwork, "getActiveNetwork");
function walletName(opts) {
  const s = stateFor(opts?.network);
  if (!s.connectedWallet) return null;
  return s.connectedWallet.metadata?.name ?? null;
}
__name(walletName, "walletName");
function reset(opts) {
  const targets = opts?.network ? [opts.network] : Array.from(NETWORKS);
  for (const n of targets) {
    networkStates[n] = { connector: null, connectedWallet: null, currentAccountId: null };
  }
  if (!opts?.network) activeNetwork = "mainnet";
}
__name(reset, "reset");
function onConnect(cb) {
  connectListeners.push(cb);
}
__name(onConnect, "onConnect");
function onDisconnect(cb) {
  disconnectListeners.push(cb);
}
__name(onDisconnect, "onDisconnect");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  accountId,
  addFunctionCallKey,
  availableWallets,
  connect,
  connectedNetworks,
  disconnect,
  getActiveNetwork,
  isConnected,
  onConnect,
  onDisconnect,
  registerDebugWallet,
  removeDebugWallet,
  reset,
  restore,
  selectWallet,
  sendTransaction,
  sendTransactions,
  signDelegateActions,
  signMessage,
  switchNetwork,
  walletName
});
//# sourceMappingURL=connector.cjs.map