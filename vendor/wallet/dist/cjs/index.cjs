/* ⋈ 🏃🏻💨 FastNear Wallet Connector - CJS (@fastnear/wallet version 1.2.0) */
/* https://www.npmjs.com/package/@fastnear/wallet/v/1.2.0 */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var index_exports = {};
__export(index_exports, {
  accountId: () => import_connector.accountId,
  addFunctionCallKey: () => import_connector.addFunctionCallKey,
  availableWallets: () => import_connector.availableWallets,
  connect: () => import_connector.connect,
  disconnect: () => import_connector.disconnect,
  isConnected: () => import_connector.isConnected,
  onConnect: () => import_connector.onConnect,
  onDisconnect: () => import_connector.onDisconnect,
  registerDebugWallet: () => import_connector.registerDebugWallet,
  removeDebugWallet: () => import_connector.removeDebugWallet,
  reset: () => import_connector.reset,
  restore: () => import_connector.restore,
  selectWallet: () => import_connector.selectWallet,
  sendTransaction: () => import_connector.sendTransaction,
  sendTransactions: () => import_connector.sendTransactions,
  signDelegateActions: () => import_connector.signDelegateActions,
  signMessage: () => import_connector.signMessage,
  switchNetwork: () => import_connector.switchNetwork,
  walletName: () => import_connector.walletName
});
module.exports = __toCommonJS(index_exports);
var import_connector = require("./connector");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  accountId,
  addFunctionCallKey,
  availableWallets,
  connect,
  disconnect,
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
//# sourceMappingURL=index.cjs.map