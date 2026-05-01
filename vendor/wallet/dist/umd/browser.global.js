/* ⋈ 🏃🏻💨 FastNear Wallet Connector - IIFE/UMD (@fastnear/wallet version 1.2.0) */
/* https://www.npmjs.com/package/@fastnear/wallet/v/1.2.0 */
"use strict";
var nearWallet = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
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
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../node_modules/@fastnear/near-connect/build/helpers/storage.js
  var require_storage = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/helpers/storage.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.LocalStorage = void 0;
      var LocalStorage = class {
        static {
          __name(this, "LocalStorage");
        }
        async get(key) {
          if (typeof window === "undefined")
            return null;
          return localStorage.getItem(key);
        }
        async set(key, value) {
          if (typeof window === "undefined")
            return;
          localStorage.setItem(key, value);
        }
        async remove(key) {
          if (typeof window === "undefined")
            return;
          localStorage.removeItem(key);
        }
      };
      exports.LocalStorage = LocalStorage;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/helpers/base58.js
  var require_base58 = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/helpers/base58.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.encodeBase58 = encodeBase58;
      var BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      function encodeBase58(bytes) {
        if (bytes.length === 0)
          return "";
        let zeros = 0;
        let i = 0;
        while (i < bytes.length && bytes[i] === 0) {
          zeros++;
          i++;
        }
        let digits = [0];
        for (; i < bytes.length; i++) {
          let carry = bytes[i];
          for (let j = 0; j < digits.length; ++j) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = carry / 58 | 0;
          }
          while (carry > 0) {
            digits.push(carry % 58);
            carry = carry / 58 | 0;
          }
        }
        while (digits.length > 0 && digits[digits.length - 1] === 0)
          digits.pop();
        let result = "";
        for (let k = 0; k < zeros; k++) {
          result += BASE58_ALPHABET[0];
        }
        for (let q = digits.length - 1; q >= 0; --q) {
          result += BASE58_ALPHABET[digits[q]];
        }
        return result;
      }
      __name(encodeBase58, "encodeBase58");
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/actions/index.js
  var require_actions = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/actions/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.nearActionsToConnectorActions = void 0;
      var base58_1 = require_base58();
      var deserializeArgs = /* @__PURE__ */ __name((args) => {
        try {
          return JSON.parse(new TextDecoder().decode(args));
        } catch {
          return args;
        }
      }, "deserializeArgs");
      var nearActionsToConnectorActions = /* @__PURE__ */ __name((actions) => {
        return actions.map((action) => {
          if ("type" in action)
            return action;
          if (action.functionCall) {
            return {
              type: "FunctionCall",
              params: {
                methodName: action.functionCall.methodName,
                args: deserializeArgs(action.functionCall.args),
                gas: action.functionCall.gas.toString(),
                deposit: action.functionCall.deposit.toString()
              }
            };
          }
          if (action.deployGlobalContract) {
            return {
              type: "DeployGlobalContract",
              params: {
                code: action.deployGlobalContract.code,
                deployMode: action.deployGlobalContract.deployMode.AccountId ? "AccountId" : "CodeHash"
              }
            };
          }
          if (action.createAccount) {
            return { type: "CreateAccount" };
          }
          if (action.useGlobalContract) {
            return {
              type: "UseGlobalContract",
              params: {
                contractIdentifier: action.useGlobalContract.contractIdentifier.AccountId ? { accountId: action.useGlobalContract.contractIdentifier.AccountId } : { codeHash: (0, base58_1.encodeBase58)(action.useGlobalContract.contractIdentifier.CodeHash) }
              }
            };
          }
          if (action.deployContract) {
            return {
              type: "DeployContract",
              params: { code: action.deployContract.code }
            };
          }
          if (action.deleteAccount) {
            return {
              type: "DeleteAccount",
              params: { beneficiaryId: action.deleteAccount.beneficiaryId }
            };
          }
          if (action.deleteKey) {
            return {
              type: "DeleteKey",
              params: { publicKey: action.deleteKey.publicKey.toString() }
            };
          }
          if (action.transfer) {
            return {
              type: "Transfer",
              params: { deposit: action.transfer.deposit.toString() }
            };
          }
          if (action.stake) {
            return {
              type: "Stake",
              params: {
                stake: action.stake.stake.toString(),
                publicKey: action.stake.publicKey.toString()
              }
            };
          }
          if (action.addKey) {
            return {
              type: "AddKey",
              params: {
                publicKey: action.addKey.publicKey.toString(),
                accessKey: {
                  nonce: Number(action.addKey.accessKey.nonce),
                  permission: action.addKey.accessKey.permission.functionCall ? {
                    receiverId: action.addKey.accessKey.permission.functionCall.receiverId,
                    allowance: action.addKey.accessKey.permission.functionCall.allowance?.toString(),
                    methodNames: action.addKey.accessKey.permission.functionCall.methodNames
                  } : "FullAccess"
                }
              }
            };
          }
          throw new Error("Unsupported action type");
        });
      }, "nearActionsToConnectorActions");
      exports.nearActionsToConnectorActions = nearActionsToConnectorActions;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/helpers/uuid.js
  var require_uuid = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/helpers/uuid.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.uuid4 = void 0;
      var uuid4 = /* @__PURE__ */ __name(() => {
        if (typeof window !== "undefined" && typeof window.crypto !== "undefined" && typeof window.crypto.randomUUID === "function")
          return window.crypto.randomUUID();
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === "x" ? r : r & 3 | 8;
          return v.toString(16);
        });
      }, "uuid4");
      exports.uuid4 = uuid4;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/ParentFrameWallet.js
  var require_ParentFrameWallet = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/ParentFrameWallet.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ParentFrameWallet = void 0;
      var actions_1 = require_actions();
      var uuid_1 = require_uuid();
      var ParentFrameWallet = class {
        static {
          __name(this, "ParentFrameWallet");
        }
        connector;
        manifest;
        constructor(connector, manifest) {
          this.connector = connector;
          this.manifest = manifest;
        }
        callParentFrame(method, params) {
          const id = (0, uuid_1.uuid4)();
          window.parent.postMessage({ type: "near-wallet-injected-request", id, method, params }, "*");
          return new Promise((resolve, reject) => {
            const handler = /* @__PURE__ */ __name((event) => {
              if (event.data.type === "near-wallet-injected-response" && event.data.id === id) {
                window.removeEventListener("message", handler);
                if (event.data.success)
                  resolve(event.data.result);
                else
                  reject(event.data.error);
              }
            }, "handler");
            window.addEventListener("message", handler);
          });
        }
        async signIn(data) {
          const result = await this.callParentFrame("near:signIn", {
            network: data?.network || this.connector.network,
            contractId: data?.contractId,
            methodNames: data?.methodNames
          });
          if (Array.isArray(result))
            return result;
          return [result];
        }
        async signInAndSignMessage(data) {
          const result = await this.callParentFrame("near:signInAndSignMessage", {
            network: data?.network || this.connector.network,
            contractId: data?.contractId,
            methodNames: data?.methodNames,
            messageParams: data.messageParams
          });
          if (Array.isArray(result))
            return result;
          return [result];
        }
        async signOut(data) {
          const args = { ...data, network: data?.network || this.connector.network };
          await this.callParentFrame("near:signOut", args);
        }
        async getAccounts(data) {
          const args = { ...data, network: data?.network || this.connector.network };
          return this.callParentFrame("near:getAccounts", args);
        }
        async signAndSendTransaction(params) {
          const connectorActions = (0, actions_1.nearActionsToConnectorActions)(params.actions);
          const args = { ...params, actions: connectorActions, network: params.network || this.connector.network };
          return this.callParentFrame("near:signAndSendTransaction", args);
        }
        async signAndSendTransactions(params) {
          const args = { ...params, network: params.network || this.connector.network };
          args.transactions = args.transactions.map((transaction) => ({
            actions: (0, actions_1.nearActionsToConnectorActions)(transaction.actions),
            receiverId: transaction.receiverId
          }));
          return this.callParentFrame("near:signAndSendTransactions", args);
        }
        async signMessage(params) {
          const args = { ...params, network: params.network || this.connector.network };
          return this.callParentFrame("near:signMessage", args);
        }
        async signDelegateActions(params) {
          const args = {
            ...params,
            delegateActions: params.delegateActions.map((delegateAction) => ({
              ...delegateAction,
              actions: (0, actions_1.nearActionsToConnectorActions)(delegateAction.actions)
            })),
            network: params.network || this.connector.network
          };
          return this.callParentFrame("near:signDelegateActions", args);
        }
        async addFunctionCallKey(params) {
          const args = { ...params, network: params.network || this.connector.network };
          return this.callParentFrame("near:addFunctionCallKey", args);
        }
      };
      exports.ParentFrameWallet = ParentFrameWallet;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/helpers/url.js
  var require_url = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/helpers/url.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.parseUrl = void 0;
      var parseUrl = /* @__PURE__ */ __name((url) => {
        try {
          return new URL(url);
        } catch {
          return null;
        }
      }, "parseUrl");
      exports.parseUrl = parseUrl;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/helpers/events.js
  var require_events = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/helpers/events.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.EventEmitter = void 0;
      var EventEmitter = class {
        static {
          __name(this, "EventEmitter");
        }
        /** Internal storage for event callbacks */
        events = {};
        /**
         * Subscribe to an event
         * @template K Event name type
         * @param event Name of the event to subscribe to
         * @param callback Function to be called when event is emitted
         */
        on(event, callback) {
          if (!this.events[event])
            this.events[event] = [];
          this.events[event].push(callback);
        }
        /**
         * Emit an event with payload
         * @template K Event name type
         * @param event Name of the event to emit
         * @param payload Data to pass to event handlers
         */
        emit(event, payload) {
          this.events[event]?.forEach((cb) => cb(payload));
        }
        /**
         * Unsubscribe from an event
         * @template K Event name type
         * @param event Name of the event to unsubscribe from
         * @param callback Function to remove from event handlers
         */
        off(event, callback) {
          this.events[event] = this.events[event]?.filter((cb) => cb !== callback);
        }
        /**
         * Subscribe to an event for a single emission
         * @template K Event name type
         * @param event Name of the event to subscribe to
         * @param callback Function to be called when event is emitted
         */
        once(event, callback) {
          const onceWrapper = /* @__PURE__ */ __name((payload) => {
            callback(payload);
            this.off(event, onceWrapper);
          }, "onceWrapper");
          this.on(event, onceWrapper);
        }
        /**
         * Remove all event listeners
         * @template K Event name type
         * @param event Optional event name to remove listeners for. If not provided, removes all listeners for all events
         */
        removeAllListeners(event) {
          if (event) {
            delete this.events[event];
          } else {
            this.events = {};
          }
        }
      };
      exports.EventEmitter = EventEmitter;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/helpers/html.js
  var require_html = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/helpers/html.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.escapeHtml = escapeHtml;
      exports.html = html;
      function escapeHtml(unsafe) {
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      }
      __name(escapeHtml, "escapeHtml");
      var htmlTag = Symbol("htmlTag");
      function html(strings, ...values) {
        let result = strings[0];
        for (let i = 0; i < values.length; i++) {
          for (const value of Array.isArray(values[i]) ? values[i] : [values[i]]) {
            const escaped = value?.[htmlTag] ? value[htmlTag] : escapeHtml(String(value ?? ""));
            result += escaped;
          }
          result += strings[i + 1];
        }
        return Object.freeze({
          [htmlTag]: result,
          get html() {
            return result;
          }
        });
      }
      __name(html, "html");
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/popups/styles.js
  var require_styles = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/popups/styles.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.css = void 0;
      var css = /* @__PURE__ */ __name((id) => (
        /*css*/
        `
${id} * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  -ms-overflow-style: none; 
  scrollbar-width: none; 
  color: #fff;
}

${id} *::-webkit-scrollbar { 
  display: none;
}

${id} p,
${id} h1,
${id} h2,
${id} h3,
${id} h4,
${id} h5,
${id} h6 {
  margin: 0;
}

${id} .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100000000;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    transition: opacity 0.2s ease-in-out;
}

@media (max-width: 600px) {
  ${id} .modal-container {
    justify-content: flex-end;
  }
}

${id} .modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;

  max-width: 420px;
  max-height: 665px;
  width: 100%;
  border-radius: 24px;
  background: #0d0d0d;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease-in-out;
}

@media (max-width: 600px) {
  ${id} .modal-content {
    max-width: 100%;
    width: 100%;
    max-height: 80%;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border: none;
    border-top: 1.5px solid rgba(255, 255, 255, 0.1);
  }
}


${id} .modal-header {
  display: flex;
  padding: 16px;
  gap: 16px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  position: relative;
}

${id} .modal-header button {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

${id} .modal-header button:hover {
  background: rgba(255, 255, 255, 0.04);
}
  
${id} .modal-header p {
  color: #fff;
  text-align: center;
  font-size: 24px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin: 0;
}


${id} .modal-body {
  display: flex;
  padding: 16px;
  flex-direction: column;
  align-items: flex-start;
  text-align: center;
  gap: 8px;
  overflow: auto;

  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  width: 100%;
  flex: 1;
}

${id} .modal-body textarea {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #0d0d0d;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  outline: none;
  font-size: 16px;
  transition: background 0.2s ease-in-out;
  font-family: monospace;
  font-size: 12px;
}

${id} .modal-body button {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  color: #000;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease-in-out;
  margin-top: 16px;
}

${id} .footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 24px;
  color: #fff;
  gap: 12px;
}

${id} .modal-body p {
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
  letter-spacing: -0.8px;
}

${id} .footer img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

${id} .get-wallet-link {
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  margin-left: auto;
  text-decoration: none;
  transition: color 0.2s ease-in-out;
  cursor: pointer;
}
  
${id} .get-wallet-link:hover {
  color: rgba(255, 255, 255, 1);
}


${id} .connect-item {
  display: flex;
  padding: 8px;
  align-items: center;
  gap: 12px;
  align-self: stretch;
  cursor: pointer;

  transition: background 0.2s ease-in-out;
  border-radius: 24px;
}

${id} .connect-item img {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  object-fit: cover;
  flex-shrink: 0;
}

${id} .connect-item-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  flex: 1;
  margin-top: -2px;
}

${id} .connect-item-info .wallet-address {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

${id} .connect-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

${id} .connect-item img {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  object-fit: cover;
}

${id} .connect-item p {
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  font-size: 18px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  letter-spacing: -0.36px;
  margin: 0;
}
`
      ), "css");
      exports.css = css;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/popups/Popup.js
  var require_Popup = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/popups/Popup.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Popup = void 0;
      var styles_1 = require_styles();
      var html_1 = require_html();
      var ID = `n${Math.random().toString(36).substring(2, 15)}`;
      if (typeof document !== "undefined") {
        const style = document.createElement("style");
        style.textContent = (0, styles_1.css)(`.${ID}`);
        document.head.append(style);
      }
      var Popup = class {
        static {
          __name(this, "Popup");
        }
        delegate;
        isClosed = false;
        root = document.createElement("div");
        state = {};
        constructor(delegate) {
          this.delegate = delegate;
        }
        get dom() {
          return (0, html_1.html)``;
        }
        disposables = [];
        addListener(querySelector, event, callback) {
          const element = typeof querySelector === "string" ? this.root.querySelector(querySelector) : querySelector;
          if (!element)
            return;
          element.addEventListener(event, callback);
          this.disposables.push(() => element.removeEventListener(event, callback));
        }
        handlers() {
          this.disposables.forEach((dispose) => dispose());
          this.disposables = [];
          const modalContainer = this.root.querySelector(".modal-container");
          const modalContent = this.root.querySelector(".modal-content");
          modalContent.onclick = (e) => e.stopPropagation();
          modalContainer.onclick = () => {
            this.delegate.onReject();
            this.destroy();
          };
        }
        update(state) {
          this.state = { ...this.state, ...state };
          this.root.innerHTML = this.dom.html;
          this.handlers();
        }
        create({ show = true }) {
          this.root.className = `${ID} hot-connector-popup`;
          this.root.style.display = "none";
          this.root.innerHTML = this.dom.html;
          document.body.append(this.root);
          this.handlers();
          const modalContainer = this.root.querySelector(".modal-container");
          const modalContent = this.root.querySelector(".modal-content");
          modalContent.style.transform = "translateY(50px)";
          modalContainer.style.opacity = "0";
          if (show) {
            setTimeout(() => this.show(), 10);
          }
        }
        show() {
          const modalContainer = this.root.querySelector(".modal-container");
          const modalContent = this.root.querySelector(".modal-content");
          modalContent.style.transform = "translateY(50px)";
          modalContainer.style.opacity = "0";
          this.root.style.display = "block";
          setTimeout(() => {
            modalContent.style.transform = "translateY(0)";
            modalContainer.style.opacity = "1";
          }, 100);
        }
        hide() {
          const modalContainer = this.root.querySelector(".modal-container");
          const modalContent = this.root.querySelector(".modal-content");
          modalContent.style.transform = "translateY(50px)";
          modalContainer.style.opacity = "0";
          setTimeout(() => {
            this.root.style.display = "none";
          }, 200);
        }
        destroy() {
          if (this.isClosed)
            return;
          this.isClosed = true;
          this.hide();
          setTimeout(() => {
            this.root.remove();
          }, 200);
        }
      };
      exports.Popup = Popup;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/popups/IframeWalletPopup.js
  var require_IframeWalletPopup = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/popups/IframeWalletPopup.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.IframeWalletPopup = void 0;
      var html_1 = require_html();
      var Popup_1 = require_Popup();
      var IframeWalletPopup = class extends Popup_1.Popup {
        static {
          __name(this, "IframeWalletPopup");
        }
        delegate;
        constructor(delegate) {
          super(delegate);
          this.delegate = delegate;
        }
        handlers() {
          super.handlers();
          this.addListener("button", "click", () => this.delegate.onApprove());
        }
        create() {
          super.create({ show: false });
          const modalBody = this.root.querySelector(".modal-body");
          modalBody.appendChild(this.delegate.iframe);
          this.delegate.iframe.style.width = "100%";
          this.delegate.iframe.style.height = "770px";
          this.delegate.iframe.style.border = "none";
        }
        get footer() {
          if (!this.delegate.footer)
            return "";
          const { icon, heading } = this.delegate.footer;
          return (0, html_1.html)`
      <div class="footer">
        ${icon ? (0, html_1.html)`<img src="${icon}" alt="${heading}" />` : ""}
        <p>${heading}</p>
      </div>
    `;
        }
        get dom() {
          return (0, html_1.html)`<div class="modal-container">
      <div class="modal-content">
        <div class="modal-body" style="padding: 0; overflow: auto;"></div>
        ${this.footer}
      </div>
    </div>`;
        }
      };
      exports.IframeWalletPopup = IframeWalletPopup;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/near_connect_static.js
  var require_near_connect_static = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/near_connect_static.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.NEAR_CONNECT_VERSION = void 0;
      exports.NEAR_CONNECT_VERSION = "0.12.1";
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/SandboxedWallet/code.js
  var require_code = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/SandboxedWallet/code.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var near_connect_static_1 = require_near_connect_static();
      async function getIframeCode(args) {
        const storage = await args.executor.getAllStorage();
        const providers = args.executor.connector.providers;
        const manifest = args.executor.manifest;
        const uuid = args.id;
        const code = args.code.replaceAll(".localStorage", ".sandboxedLocalStorage").replaceAll(/(?<![.\w])localStorage(?=[\.\[\(])/g, "window.sandboxedLocalStorage").replaceAll("window.top", "window.selector").replaceAll("window.open", "window.selector.open");
        return (
          /* html */
          `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <div id="root"></div>

      <style>
        :root {
          --background-color: rgb(40, 40, 40);
          --text-color: rgb(255, 255, 255);
          --border-color: rgb(209, 209, 209);
        }

        * {
          font-family: system-ui, Avenir, Helvetica, Arial, sans-serif
        }

        body, html {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          background-color: var(--background-color);
          color: var(--text-color);
        }

        #root {
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          width: 100vw;
          background: radial-gradient(circle at center, #2c2c2c 0%, #1a1a1a 100%);
          text-align: center;
        }

        #root * {
          box-sizing: border-box;
          font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color-scheme: light dark;
          color: rgb(255, 255, 255);
          font-synthesis: none;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }

        .prompt-container img {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 12px;
        }

        .prompt-container h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          margin-top: 16px;
        }

        .prompt-container p {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          color: rgb(209, 209, 209);
        }

        .prompt-container button {
          background-color: #131313;
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          cursor: pointer;
          transition: border-color 0.25s;
          color: #fff;
          outline: none;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          margin-top: 16px;
        }
      </style>


      <script>
      window.addEventListener("error", function(event) {
        var msg = event.message + (event.filename ? " at " + event.filename + ":" + event.lineno : "");
        console.error("[near-connect iframe] error:", msg);
        window.parent.postMessage({
          method: "wallet-error",
          origin: "${uuid}",
          error: msg
        }, "*");
      });
      window.addEventListener("unhandledrejection", function(event) {
        console.error("[near-connect iframe] unhandledrejection:", String(event.reason));
        window.parent.postMessage({
          method: "wallet-error",
          origin: "${uuid}",
          error: String(event.reason)
        }, "*");
      });
      <\/script>

      <script>
      // Fix fetch binding in sandboxed iframe \u2014 bundled code that aliases
      // or destructures fetch loses the window context, causing
      // "Failed to execute 'fetch' on 'Window': Illegal invocation".
      if (typeof fetch === 'function') {
        window.fetch = fetch.bind(window);
      }

      window.sandboxedLocalStorage = (() => {
        let storage = ${JSON.stringify(storage)}

        return {
          setItem: function(key, value) {
            window.selector.storage.set(key, value)
            storage[key] = value || '';
          },
          getItem: function(key) {
            return key in storage ? storage[key] : null;
          },
          removeItem: function(key) {
            window.selector.storage.remove(key)
            delete storage[key];
          },
          get length() {
            return Object.keys(storage).length;
          },
          key: function(i) {
            const keys = Object.keys(storage);
            return keys[i] || null;
          },
        };
      })();

      // Override the localStorage property so that any access pattern
      // (including SES lockdown introspection) returns the proxy
      // instead of throwing a SecurityError in the sandboxed iframe.
      try {
        Object.defineProperty(window, 'localStorage', {
          get: function() { return window.sandboxedLocalStorage; },
          configurable: true,
        });
      } catch (e) {
        // Silently ignore if the property can't be redefined
      }

      const showPrompt = async (args) => {
        const root = document.getElementById("root");   
        root.style.display = "flex";
        root.innerHTML = \`
          <div class="prompt-container">
            <img src="${manifest.icon}" />
            <h1>${manifest.name}</h1>
            <p>\${args.title}</p>
            <button>\${args.button}</button>
          </div>
        \`;

        return new Promise((resolve) => {
          root.querySelector("button")?.addEventListener("click", () => {
            root.innerHTML = "";
            resolve(true);
          });
        });
      }

      class ProxyWindow {
        constructor(url, features) {
          this.closed = false;
          this.windowIdPromise = window.selector.call("open", { url, features });

          window.addEventListener("message", async (event) => {            
            if (event.data.origin !== "${uuid}") return;
            if (!event.data.method?.startsWith("proxy-window:")) return;
            const method = event.data.method.replace("proxy-window:", "");
            if (method === "closed" && event.data.windowId === await this.id()) this.closed = true;
          });
        } 

        async id() {
          return await this.windowIdPromise;
        }

        async focus() {
          await window.selector.call("panel.focus", { windowId: await this.id() });
        }

        async postMessage(data) {
          window.selector.call("panel.postMessage", { windowId: await this.id(), data });
        }

        async close() {
          await window.selector.call("panel.close", { windowId: await this.id() });
        }
      }

      window.selector = {
        wallet: null,
        location: "${window.location.href}",
        nearConnectVersion: "${near_connect_static_1.NEAR_CONNECT_VERSION}",
        
        outerHeight: ${window.outerHeight},
        screenY: ${window.screenY},
        outerWidth: ${window.outerWidth},
        screenX: ${window.screenX},

        providers: {
          mainnet: ${JSON.stringify(providers.mainnet)},
          testnet: ${JSON.stringify(providers.testnet)},
        },

        uuid() {
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        },

        walletConnect: {
          getConfig() {
            return window.selector.call("walletConnect.getConfig", {});
          },
        },
      
        async ready(wallet) {
          window.parent.postMessage({ method: "wallet-ready", origin: "${uuid}" }, "*");
          window.selector.wallet = wallet;
        },

        async call(method, params) {
          const id = window.selector.uuid();
          window.parent.postMessage({ method, params, id, origin: "${uuid}" }, "*");

          return new Promise((resolve, reject) => {
            const handler = (event) => {
              if (event.data.id !== id || event.data.origin !== "${uuid}") return;
              window.removeEventListener("message", handler);

              if (event.data.status === "failed") reject(event.data.result);
              else resolve(event.data.result);
            };

            window.addEventListener("message", handler);
          });
        },

        panelClosed(windowId) {
          window.parent.postMessage({ 
            method: "panel.closed", 
            origin: "${uuid}", 
            result: { windowId } 
          }, "*");
        },

        open(url, _, params) {
          return new ProxyWindow(url, params)
        },

        external(entity, key, ...args) {
          return window.selector.call("external", { entity, key, args: args || [] });
        },

        openNativeApp(url) {
          return window.selector.call("open.nativeApp", { url });
        },

        ui: {
          async whenApprove(options) {
            window.selector.ui.showIframe();
            await showPrompt(options);
            window.selector.ui.hideIframe();
          },

          async showIframe() {
            return await window.selector.call("ui.showIframe");
          },

          async hideIframe() {
            return await window.selector.call("ui.hideIframe");
          },
        },

        storage: {
          async set(key, value) {
            await window.selector.call("storage.set", { key, value });
          },
      
          async get(key) {
            return await window.selector.call("storage.get", { key });
          },
      
          async remove(key) {
            await window.selector.call("storage.remove", { key });
          },

          async keys() {
            return await window.selector.call("storage.keys", {});
          },
        },
      };

      window.addEventListener("message", async (event) => {
        if (event.data.origin !== "${uuid}") return;
        if (!event.data.method?.startsWith("wallet:")) return;
      
        const wallet = window.selector.wallet;
        const method = event.data.method.replace("wallet:", "");
        const payload = { id: event.data.id, origin: "${uuid}", method };
      
        if (wallet == null || typeof wallet[method] !== "function") {
          const data = { ...payload, status: "failed", result: "Method not found" };
          window.parent.postMessage(data, "*");
          return;
        }
        
        try {
          // Ensure signerId is available in sandboxedLocalStorage for wallet code that reads it
          if (event.data.params?.signerId) {
            window.sandboxedLocalStorage.setItem("signedAccountId", event.data.params.signerId);
          }

          const result = await wallet[method](event.data.params);
          window.parent.postMessage({ ...payload, status: "success", result }, "*");
        } catch (error) {
          const data = { ...payload, status: "failed", result: error };
          window.parent.postMessage(data, "*");
        }
      });
      <\/script>

      <script type="module">${code}<\/script>
    </body>
  </html>
    `
        );
      }
      __name(getIframeCode, "getIframeCode");
      exports.default = getIframeCode;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/SandboxedWallet/iframe.js
  var require_iframe = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/SandboxedWallet/iframe.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      var events_1 = require_events();
      var uuid_1 = require_uuid();
      var IframeWalletPopup_1 = require_IframeWalletPopup();
      var code_1 = __importDefault(require_code());
      var IframeExecutor = class {
        static {
          __name(this, "IframeExecutor");
        }
        executor;
        origin;
        iframe = document.createElement("iframe");
        events = new events_1.EventEmitter();
        popup;
        handler;
        readyPromiseResolve;
        readyPromiseReject;
        readyPromise = new Promise((resolve, reject) => {
          this.readyPromiseResolve = resolve;
          this.readyPromiseReject = reject;
        });
        constructor(executor, code, onMessage) {
          this.executor = executor;
          this.origin = (0, uuid_1.uuid4)();
          this.handler = (event) => {
            if (event.data.origin !== this.origin)
              return;
            if (event.data.method === "wallet-ready") {
              console.log(`[near-connect] wallet-ready received for "${this.executor.manifest.name}"`);
              this.readyPromiseResolve();
            }
            if (event.data.method === "wallet-error") {
              console.error(`[near-connect] wallet-error for "${this.executor.manifest.name}":`, event.data.error);
              this.readyPromiseReject(new Error(`Wallet executor crashed: ${event.data.error}`));
            }
            onMessage(this, event);
          };
          window.addEventListener("message", this.handler);
          const iframeAllowedPersimissions = [];
          if (this.executor.checkPermissions("usb"))
            iframeAllowedPersimissions.push("usb *;");
          if (this.executor.checkPermissions("hid"))
            iframeAllowedPersimissions.push("hid *;");
          if (this.executor.checkPermissions("clipboardRead"))
            iframeAllowedPersimissions.push("clipboard-read;");
          if (this.executor.checkPermissions("clipboardWrite"))
            iframeAllowedPersimissions.push("clipboard-write;");
          this.iframe.allow = iframeAllowedPersimissions.join(" ");
          this.iframe.setAttribute("sandbox", "allow-scripts");
          (0, code_1.default)({ id: this.origin, executor: this.executor, code }).then((code2) => {
            this.executor.connector.logger?.log(`Iframe code injected`);
            this.iframe.srcdoc = code2;
          });
          this.popup = new IframeWalletPopup_1.IframeWalletPopup({
            footer: this.executor.connector.footerBranding,
            iframe: this.iframe,
            onApprove: /* @__PURE__ */ __name(() => {
            }, "onApprove"),
            onReject: /* @__PURE__ */ __name(() => {
              window.removeEventListener("message", this.handler);
              this.events.emit("close", {});
              this.popup.destroy();
            }, "onReject")
          });
          this.popup.create();
        }
        on(event, callback) {
          this.events.on(event, callback);
        }
        show() {
          this.popup.show();
        }
        hide() {
          this.popup.hide();
        }
        postMessage(data) {
          if (!this.iframe.contentWindow)
            throw new Error("Iframe not loaded");
          this.iframe.contentWindow.postMessage({ ...data, origin: this.origin }, "*");
        }
        dispose() {
          window.removeEventListener("message", this.handler);
          this.popup.destroy();
        }
      };
      exports.default = IframeExecutor;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/SandboxedWallet/executor.js
  var require_executor = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/SandboxedWallet/executor.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      var url_1 = require_url();
      var uuid_1 = require_uuid();
      var iframe_1 = __importDefault(require_iframe());
      var cacheId = (0, uuid_1.uuid4)();
      var SUPPORTED_NETWORKS = ["mainnet", "testnet"];
      var LEGACY_MIGRATION_NETWORK = "mainnet";
      var migratedManifestIds = /* @__PURE__ */ new Set();
      var SandboxExecutor = class {
        static {
          __name(this, "SandboxExecutor");
        }
        connector;
        manifest;
        activePanels = {};
        constructor(connector, manifest) {
          this.connector = connector;
          this.manifest = manifest;
          this.migrateLegacyStorage();
        }
        /**
         * Storage namespace for proxied iframe localStorage keys, scoped to
         * `${manifestId}:${network}`. Each network gets its own slot so signing
         * into mainnet and testnet on the same page doesn't collide.
         *
         * Reads `connector.network` live so that `connector.switchNetwork(...)`
         * (which mutates `connector.network`) immediately retargets storage to
         * the new network's slot for subsequent calls.
         */
        get storageSpace() {
          return `${this.manifest.id}:${this.connector.network}`;
        }
        prefixForNetwork(network) {
          return `${this.manifest.id}:${network}:`;
        }
        /**
         * One-shot migration of pre-network-namespaced keys.
         *
         * Old shape: `${manifestId}:${key}` (single colon).
         * New shape: `${manifestId}:${network}:${key}` (network segment).
         *
         * Any legacy key (matches `${manifestId}:` but not `${manifestId}:mainnet:`
         * or `${manifestId}:testnet:`) is moved into the mainnet slot — that's the
         * only network the unscoped library could meaningfully have written for.
         */
        migrateLegacyStorage() {
          if (typeof localStorage === "undefined")
            return;
          if (migratedManifestIds.has(this.manifest.id))
            return;
          migratedManifestIds.add(this.manifest.id);
          const idColon = `${this.manifest.id}:`;
          const namespacedPrefixes = SUPPORTED_NETWORKS.map((n) => this.prefixForNetwork(n));
          const moves = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(idColon))
              continue;
            if (namespacedPrefixes.some((p) => key.startsWith(p)))
              continue;
            const tail = key.slice(idColon.length);
            moves.push({
              from: key,
              to: `${this.prefixForNetwork(LEGACY_MIGRATION_NETWORK)}${tail}`
            });
          }
          for (const { from, to } of moves) {
            if (localStorage.getItem(to) === null) {
              const value = localStorage.getItem(from);
              if (value !== null)
                localStorage.setItem(to, value);
            }
            localStorage.removeItem(from);
          }
        }
        checkPermissions(action, params) {
          if (action === "walletConnect") {
            return !!this.manifest.permissions.walletConnect;
          }
          if (action === "external") {
            const external = this.manifest.permissions.external;
            if (!external || !params?.entity)
              return false;
            return external.includes(params.entity);
          }
          if (action === "allowsOpen") {
            const openUrl = (0, url_1.parseUrl)(params?.url || "");
            const allowsOpen = this.manifest.permissions.allowsOpen;
            if (!openUrl || !allowsOpen || !Array.isArray(allowsOpen) || allowsOpen.length === 0)
              return false;
            const isAllowed = allowsOpen.some((path) => {
              const url = (0, url_1.parseUrl)(path);
              if (!url)
                return false;
              if (openUrl.protocol !== url.protocol)
                return false;
              if (!!url.hostname && openUrl.hostname !== url.hostname)
                return false;
              if (!!url.pathname && url.pathname !== "/" && openUrl.pathname !== url.pathname)
                return false;
              return true;
            });
            return isAllowed;
          }
          return this.manifest.permissions[action];
        }
        assertPermissions(iframe, action, event) {
          if (!this.checkPermissions(action, event.data.params)) {
            iframe.postMessage({ ...event.data, status: "failed", result: "Permission denied" });
            throw new Error("Permission denied");
          }
        }
        _onMessage = /* @__PURE__ */ __name(async (iframe, event) => {
          const success = /* @__PURE__ */ __name((result) => {
            iframe.postMessage({ ...event.data, status: "success", result });
          }, "success");
          const failed = /* @__PURE__ */ __name((error) => {
            iframe.postMessage({ ...event.data, status: "failed", result: error });
          }, "failed");
          if (event.data.method === "ui.showIframe") {
            iframe.show();
            success(null);
            return;
          }
          if (event.data.method === "ui.hideIframe") {
            iframe.hide();
            success(null);
            return;
          }
          if (event.data.method === "storage.set") {
            this.assertPermissions(iframe, "storage", event);
            localStorage.setItem(`${this.storageSpace}:${event.data.params.key}`, event.data.params.value);
            success(null);
            return;
          }
          if (event.data.method === "storage.get") {
            this.assertPermissions(iframe, "storage", event);
            const value = localStorage.getItem(`${this.storageSpace}:${event.data.params.key}`);
            success(value);
            return;
          }
          if (event.data.method === "storage.keys") {
            this.assertPermissions(iframe, "storage", event);
            const prefix = `${this.storageSpace}:`;
            const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
            success(keys);
            return;
          }
          if (event.data.method === "storage.remove") {
            this.assertPermissions(iframe, "storage", event);
            localStorage.removeItem(`${this.storageSpace}:${event.data.params.key}`);
            success(null);
            return;
          }
          if (event.data.method === "panel.focus") {
            const panel = this.activePanels[event.data.params.windowId];
            if (panel)
              panel.focus();
            success(null);
            return;
          }
          if (event.data.method === "panel.postMessage") {
            const panel = this.activePanels[event.data.params.windowId];
            if (panel)
              panel.postMessage(event.data.params.data, "*");
            success(null);
            return;
          }
          if (event.data.method === "panel.close") {
            const panel = this.activePanels[event.data.params.windowId];
            if (panel)
              panel.close();
            delete this.activePanels[event.data.params.windowId];
            success(null);
            return;
          }
          if (event.data.method === "walletConnect.getConfig") {
            this.assertPermissions(iframe, "walletConnect", event);
            try {
              if (!this.connector.walletConnect)
                throw new Error("WalletConnect is not configured");
              success(this.connector.walletConnect);
            } catch (e) {
              failed(e);
            }
            return;
          }
          if (event.data.method === "external") {
            this.assertPermissions(iframe, "external", event);
            try {
              const { entity, key, args } = event.data.params;
              const obj = entity.split(".").reduce((acc, key2) => acc[key2], window);
              if (entity === "nightly.near" && key === "signTransaction") {
                args[0].encode = () => args[0];
              }
              const result = typeof obj[key] === "function" ? await obj[key](...args || []) : obj[key];
              success(result);
            } catch (e) {
              failed(e);
            }
            return;
          }
          if (event.data.method === "open") {
            this.assertPermissions(iframe, "allowsOpen", event);
            const tgapp = typeof window !== "undefined" ? window?.Telegram?.WebApp : null;
            if (tgapp && event.data.params.url.startsWith("https://t.me")) {
              tgapp.openTelegramLink(event.data.params.url);
              return;
            }
            const panel = window.open(event.data.params.url, "_blank", event.data.params.features);
            const panelId = panel ? (0, uuid_1.uuid4)() : null;
            const handler = /* @__PURE__ */ __name((ev) => {
              const url = (0, url_1.parseUrl)(event.data.params.url);
              if (url && url.origin === ev.origin) {
                iframe.postMessage(ev.data);
              }
            }, "handler");
            success(panelId);
            window.addEventListener("message", handler);
            if (panel && panelId) {
              this.activePanels[panelId] = panel;
              const interval = setInterval(() => {
                if (!panel?.closed)
                  return;
                window.removeEventListener("message", handler);
                const args = { method: "proxy-window:closed", windowId: panelId };
                delete this.activePanels[panelId];
                clearInterval(interval);
                try {
                  iframe.postMessage(args);
                } catch {
                }
              }, 500);
            }
            return;
          }
          if (event.data.method === "open.nativeApp") {
            this.assertPermissions(iframe, "allowsOpen", event);
            const url = (0, url_1.parseUrl)(event.data.params.url);
            const invalid = ["https", "http", "javascript:", "file:", "data:", "blob:", "about:"];
            if (!url || invalid.includes(url.protocol)) {
              failed("Invalid URL");
              throw new Error("[open.nativeApp] Invalid URL");
            }
            const linkIframe = document.createElement("iframe");
            linkIframe.src = event.data.params.url;
            linkIframe.style.display = "none";
            document.body.appendChild(linkIframe);
            iframe.postMessage({ ...event.data, status: "success", result: null });
            return;
          }
        }, "_onMessage");
        actualCode = null;
        async checkNewVersion(executor, currentVersion) {
          if (this.actualCode) {
            this.connector.logger?.log(`New version of code already checked`);
            return this.actualCode;
          }
          let url = (0, url_1.parseUrl)(executor.manifest.executor);
          if (!url)
            url = (0, url_1.parseUrl)(location.origin + executor.manifest.executor);
          if (!url)
            throw new Error("Invalid executor URL");
          url.searchParams.set("nonce", cacheId);
          const newVersion = await fetch(url.toString()).then((res) => res.text());
          this.connector.logger?.log(`New version of code fetched`);
          this.actualCode = newVersion;
          if (newVersion === currentVersion) {
            this.connector.logger?.log(`New version of code is the same as the current version`);
            return this.actualCode;
          }
          await this.connector.db.setItem(`${this.manifest.id}:${this.manifest.version}`, newVersion);
          this.connector.logger?.log(`New version of code saved to cache`);
          return newVersion;
        }
        async loadCode() {
          const cachedCode = await this.connector.db.getItem(`${this.manifest.id}:${this.manifest.version}`).catch(() => null);
          this.connector.logger?.log(`Code loaded from cache`, cachedCode !== null);
          const task = this.checkNewVersion(this, cachedCode);
          if (cachedCode)
            return cachedCode;
          return await task;
        }
        async call(method, params) {
          console.log(`[near-connect] call("${method}") on "${this.manifest.name}"`);
          if (params?.signerId) {
            const callNetwork = params?.network && SUPPORTED_NETWORKS.includes(params.network) ? params.network : this.connector.network;
            localStorage.setItem(`${this.prefixForNetwork(callNetwork)}signedAccountId`, params.signerId);
          }
          this.connector.logger?.log(`Add to queue`, method, params);
          this.connector.logger?.log(`Calling method`, method, params);
          const code = await this.loadCode();
          this.connector.logger?.log(`Code loaded, preparing (${code.length} bytes)`);
          const READY_TIMEOUT_MS = 5e3;
          const iframe = new iframe_1.default(this, code, this._onMessage);
          this.connector.logger?.log(`Code loaded, iframe initialized`);
          let timeoutId;
          try {
            await Promise.race([
              iframe.readyPromise,
              new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Wallet executor "${this.manifest.name}" did not initialize within ${READY_TIMEOUT_MS / 1e3}s`)), READY_TIMEOUT_MS);
              })
            ]);
          } catch (e) {
            iframe.dispose();
            throw e;
          } finally {
            clearTimeout(timeoutId);
          }
          this.connector.logger?.log(`Iframe ready`);
          const id = (0, uuid_1.uuid4)();
          return new Promise((resolve, reject) => {
            try {
              const handler = /* @__PURE__ */ __name((event) => {
                if (event.data.id !== id || event.data.origin !== iframe.origin)
                  return;
                iframe.dispose();
                window.removeEventListener("message", handler);
                this.connector.logger?.log("postMessage", { result: event.data, request: { method, params } });
                if (event.data.status === "failed") {
                  console.warn(`[near-connect] call("${method}") on "${this.manifest.name}" FAILED:`, event.data.result);
                  reject(event.data.result);
                } else {
                  console.log(`[near-connect] call("${method}") on "${this.manifest.name}" succeeded`);
                  resolve(event.data.result);
                }
              }, "handler");
              window.addEventListener("message", handler);
              iframe.postMessage({ method, params, id });
              iframe.on("close", () => reject(new Error("Wallet closed")));
            } catch (e) {
              this.connector.logger?.log(`Iframe error`, e);
              reject(e);
            }
          });
        }
        async getAllStorage(network) {
          const prefix = this.prefixForNetwork(network ?? this.connector.network);
          const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix));
          const storage = {};
          for (const key of keys) {
            storage[key.slice(prefix.length)] = localStorage.getItem(key);
          }
          return storage;
        }
        async clearStorage(network) {
          const prefix = this.prefixForNetwork(network ?? this.connector.network);
          const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix));
          for (const key of keys) {
            localStorage.removeItem(key);
          }
        }
      };
      exports.default = SandboxExecutor;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/SandboxedWallet/index.js
  var require_SandboxedWallet = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/SandboxedWallet/index.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.SandboxWallet = void 0;
      var actions_1 = require_actions();
      var executor_1 = __importDefault(require_executor());
      var SandboxWallet = class {
        static {
          __name(this, "SandboxWallet");
        }
        connector;
        manifest;
        executor;
        constructor(connector, manifest) {
          this.connector = connector;
          this.manifest = manifest;
          this.executor = new executor_1.default(connector, manifest);
        }
        async signIn(data) {
          return this.executor.call("wallet:signIn", {
            network: data?.network || this.connector.network,
            contractId: data?.contractId,
            methodNames: data?.methodNames
          });
        }
        async signInAndSignMessage(data) {
          return this.executor.call("wallet:signInAndSignMessage", {
            network: data?.network || this.connector.network,
            contractId: data?.contractId,
            methodNames: data?.methodNames,
            messageParams: data.messageParams
          });
        }
        async signOut(data) {
          const network = data?.network || this.connector.network;
          const args = { ...data, network };
          await this.executor.call("wallet:signOut", args);
          await this.executor.clearStorage(network);
        }
        async getAccounts(data) {
          const args = { ...data, network: data?.network || this.connector.network };
          return this.executor.call("wallet:getAccounts", args);
        }
        async signAndSendTransaction(params) {
          const actions = (0, actions_1.nearActionsToConnectorActions)(params.actions);
          const args = { ...params, actions, network: params.network || this.connector.network };
          return this.executor.call("wallet:signAndSendTransaction", args);
        }
        async signAndSendTransactions(params) {
          const transactions = params.transactions.map((transaction) => ({
            actions: (0, actions_1.nearActionsToConnectorActions)(transaction.actions),
            receiverId: transaction.receiverId
          }));
          const args = { ...params, transactions, network: params.network || this.connector.network };
          return this.executor.call("wallet:signAndSendTransactions", args);
        }
        async signMessage(params) {
          const args = { ...params, network: params.network || this.connector.network };
          return this.executor.call("wallet:signMessage", args);
        }
        async signDelegateActions(params) {
          const args = {
            ...params,
            delegateActions: params.delegateActions.map((delegateAction) => ({
              ...delegateAction,
              actions: (0, actions_1.nearActionsToConnectorActions)(delegateAction.actions)
            })),
            network: params.network || this.connector.network
          };
          return this.executor.call("wallet:signDelegateActions", args);
        }
        async addFunctionCallKey(params) {
          const network = params.network || this.connector.network;
          const signerId = params.signerId;
          const { publicKey } = await this.executor.call("wallet:generateFunctionCallKey", {
            contractId: params.contractId,
            methodNames: params.methodNames || [],
            network
          });
          try {
            const outcome = await this.signAndSendTransaction({
              network,
              signerId,
              receiverId: signerId,
              actions: [
                {
                  type: "AddKey",
                  params: {
                    publicKey,
                    accessKey: {
                      permission: {
                        receiverId: params.contractId,
                        allowance: params.allowance,
                        methodNames: params.methodNames || []
                      }
                    }
                  }
                }
              ]
            });
            await this.executor.call("wallet:confirmFunctionCallKey", { publicKey, network });
            return { publicKey, transactionOutcome: outcome };
          } catch (error) {
            await this.executor.call("wallet:removeFunctionCallKey", { publicKey, network }).catch(() => {
            });
            throw error;
          }
        }
      };
      exports.SandboxWallet = SandboxWallet;
      exports.default = SandboxWallet;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/InjectedWallet.js
  var require_InjectedWallet = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/InjectedWallet.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.InjectedWallet = void 0;
      var actions_1 = require_actions();
      var InjectedWallet = class {
        static {
          __name(this, "InjectedWallet");
        }
        connector;
        wallet;
        constructor(connector, wallet) {
          this.connector = connector;
          this.wallet = wallet;
        }
        get manifest() {
          return this.wallet.manifest;
        }
        async signIn(data) {
          return this.wallet.signIn({
            network: data?.network || this.connector.network,
            contractId: data?.contractId,
            methodNames: data?.methodNames
          });
        }
        async signInAndSignMessage(data) {
          return this.wallet.signInAndSignMessage({
            network: data?.network || this.connector.network,
            contractId: data?.contractId,
            methodNames: data?.methodNames,
            messageParams: data.messageParams
          });
        }
        async signOut(data) {
          await this.wallet.signOut({ network: data?.network || this.connector.network });
        }
        async getAccounts(data) {
          return this.wallet.getAccounts({ network: data?.network || this.connector.network });
        }
        async signAndSendTransaction(params) {
          const actions = (0, actions_1.nearActionsToConnectorActions)(params.actions);
          const network = params.network || this.connector.network;
          const result = await this.wallet.signAndSendTransaction({ ...params, actions, network });
          if (!result)
            throw new Error("No result from wallet");
          if (Array.isArray(result.transactions))
            return result.transactions[0];
          return result;
        }
        async signAndSendTransactions(params) {
          const network = params.network || this.connector.network;
          const transactions = params.transactions.map((transaction) => ({
            actions: (0, actions_1.nearActionsToConnectorActions)(transaction.actions),
            receiverId: transaction.receiverId
          }));
          const result = await this.wallet.signAndSendTransactions({ ...params, transactions, network });
          if (!result)
            throw new Error("No result from wallet");
          if (Array.isArray(result.transactions))
            return result.transactions;
          return result;
        }
        async signMessage(params) {
          return this.wallet.signMessage({ ...params, network: params.network || this.connector.network });
        }
        async signDelegateActions(params) {
          return this.wallet.signDelegateActions({
            ...params,
            delegateActions: params.delegateActions.map((delegateAction) => ({
              ...delegateAction,
              actions: (0, actions_1.nearActionsToConnectorActions)(delegateAction.actions)
            })),
            network: params.network || this.connector.network
          });
        }
        async addFunctionCallKey(params) {
          if (!this.wallet.addFunctionCallKey)
            throw new Error("addFunctionCallKey is not supported by this wallet");
          return this.wallet.addFunctionCallKey({ ...params, network: params.network || this.connector.network });
        }
      };
      exports.InjectedWallet = InjectedWallet;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/popups/NearWalletsPopup.js
  var require_NearWalletsPopup = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/popups/NearWalletsPopup.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.NearWalletsPopup = void 0;
      var html_1 = require_html();
      var url_1 = require_url();
      var Popup_1 = require_Popup();
      var debugManifest = {
        id: "custom-wallet",
        name: "Custom Wallet",
        icon: "https://www.mynearwallet.com/images/webclip.png",
        description: "Custom wallet for NEAR.",
        website: "",
        version: "1.0.0",
        executor: "your-executor-url.js",
        type: "sandbox",
        platform: {},
        features: {
          signMessage: true,
          signInWithoutAddKey: true,
          signInAndSignMessage: true,
          signAndSendTransaction: true,
          signAndSendTransactions: true,
          signDelegateActions: true
        },
        permissions: {
          storage: true,
          allowsOpen: []
        }
      };
      var NearWalletsPopup = class extends Popup_1.Popup {
        static {
          __name(this, "NearWalletsPopup");
        }
        delegate;
        constructor(delegate) {
          super(delegate);
          this.delegate = delegate;
          this.update({ wallets: delegate.wallets, showSettings: false });
        }
        handlers() {
          super.handlers();
          this.addListener(".settings-button", "click", () => this.update({ showSettings: true }));
          this.addListener(".back-button", "click", () => this.update({ showSettings: false }));
          this.root.querySelectorAll(".connect-item").forEach((item) => {
            if (!(item instanceof HTMLDivElement))
              return;
            this.addListener(item, "click", () => this.delegate.onSelect(item.dataset.type));
          });
          this.root.querySelectorAll(".remove-wallet-button").forEach((item) => {
            if (!(item instanceof SVGSVGElement))
              return;
            this.addListener(item, "click", async (e) => {
              e.stopPropagation();
              await this.delegate.onRemoveDebugManifest(item.dataset.type);
              const wallets = this.state.wallets.filter((wallet) => wallet.id !== item.dataset.type);
              this.update({ wallets });
            });
          });
          this.addListener(".add-debug-manifest-button", "click", async () => {
            try {
              const wallet = this.root.querySelector("#debug-manifest-input")?.value ?? "";
              const manifest = await this.delegate.onAddDebugManifest(wallet);
              this.update({ showSettings: false, wallets: [manifest, ...this.state.wallets] });
            } catch (error) {
              alert(`Something went wrong: ${error}`);
            }
          });
        }
        create() {
          super.create({ show: true });
        }
        walletDom(wallet) {
          const removeButton = (0, html_1.html)`
      <svg
        class="remove-wallet-button"
        data-type="${wallet.id}"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style="margin-right: 4px;"
      >
        <path d="M18 6L6 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6 6L18 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
          return (0, html_1.html)`
      <div class="connect-item" data-type="${wallet.id}">
        <img style="background: #333" src="${wallet.icon}" alt="${wallet.name}" />
        <div class="connect-item-info">
          <span>${wallet.name}</span>
          <span class="wallet-address">${(0, url_1.parseUrl)(wallet.website)?.hostname}</span>
        </div>
        ${wallet.debug ? removeButton : ""}
      </div>
    `;
        }
        get footer() {
          if (!this.delegate.footer)
            return "";
          const { icon, heading, link, linkText } = this.delegate.footer;
          return (0, html_1.html)`
      <div class="footer">
        ${icon ? (0, html_1.html)`<img src="${icon}" alt="${heading}" />` : ""}
        <p>${heading}</p>
        <a class="get-wallet-link" href="${link}" target="_blank">${linkText}</a>
      </div>
    `;
        }
        get dom() {
          if (this.state.showSettings) {
            return (0, html_1.html)`
        <div class="modal-container">
          <div class="modal-content">
            <div class="modal-header">
              <button class="back-button" style="left: 16px; right: unset;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <p>Settings</p>
            </div>

            <div class="modal-body">
              <p style="text-align: left;">
                You can add your wallet to dapp for debug,
                <a href="https://github.com/azbang/hot-connector" target="_blank">read the documentation.</a> Paste your manifest and click "Add".
              </p>

              <textarea style="width: 100%;" id="debug-manifest-input" rows="10">${JSON.stringify(debugManifest, null, 2)}</textarea>
              <button class="add-debug-manifest-button">Add</button>
            </div>

            ${this.footer}
          </div>
        </div>
      `;
          }
          return (0, html_1.html)`<div class="modal-container">
      <div class="modal-content">
        <div class="modal-header">
          <p>Select wallet</p>
          <button class="settings-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="19" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="5" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
            </svg>
          </button>
        </div>

        <div class="modal-body">${this.state.wallets.map((wallet) => this.walletDom(wallet))}</div>

        ${this.footer}
      </div>
    </div>`;
        }
      };
      exports.NearWalletsPopup = NearWalletsPopup;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/helpers/indexdb.js
  var require_indexdb = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/helpers/indexdb.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var IndexedDB = class {
        static {
          __name(this, "IndexedDB");
        }
        dbName;
        storeName;
        version;
        constructor(dbName, storeName) {
          this.dbName = dbName;
          this.storeName = storeName;
          this.version = 1;
        }
        getDb() {
          return new Promise((resolve, reject) => {
            if (typeof window === "undefined" || typeof indexedDB === "undefined") {
              reject(new Error("IndexedDB is not available (SSR environment)"));
              return;
            }
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = (event) => {
              console.error("Error opening database:", event.target.error);
              reject(new Error("Error opening database"));
            };
            request.onsuccess = (event) => {
              resolve(request.result);
            };
            request.onupgradeneeded = (event) => {
              const db = request.result;
              const existingStores = db.objectStoreNames;
              if (!existingStores.contains(this.storeName)) {
                db.createObjectStore(this.storeName);
              }
            };
          });
        }
        async getItem(key) {
          const db = await this.getDb();
          if (typeof key === "number") {
            key = key.toString();
          }
          if (typeof key !== "string") {
            throw new Error("Key must be a string");
          }
          return new Promise((resolve, reject) => {
            if (!this.storeName) {
              reject(new Error("Store name not set"));
              return;
            }
            const transaction = db.transaction(this.storeName, "readonly");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
              resolve(request.result);
              db.close();
            };
          });
        }
        async setItem(key, value) {
          const db = await this.getDb();
          if (typeof key === "number") {
            key = key.toString();
          }
          if (typeof key !== "string") {
            throw new Error("Key must be a string");
          }
          return new Promise((resolve, reject) => {
            if (!this.storeName) {
              reject(new Error("Store name not set"));
              return;
            }
            const transaction = db.transaction(this.storeName, "readwrite");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
              db.close();
              resolve();
            };
          });
        }
        async removeItem(key) {
          const db = await this.getDb();
          if (typeof key === "number") {
            key = key.toString();
          }
          if (typeof key !== "string") {
            throw new Error("Key must be a string");
          }
          return new Promise((resolve, reject) => {
            if (!this.storeName) {
              reject(new Error("Store name not set"));
              return;
            }
            const transaction = db.transaction(this.storeName, "readwrite");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
              db.close();
              resolve();
            };
          });
        }
        async keys() {
          const db = await this.getDb();
          return new Promise((resolve, reject) => {
            if (!this.storeName) {
              reject(new Error("Store name not set"));
              return;
            }
            const transaction = db.transaction(this.storeName, "readonly");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
              resolve(request.result);
              db.close();
            };
          });
        }
        async count() {
          const db = await this.getDb();
          return new Promise((resolve, reject) => {
            if (!this.storeName) {
              reject(new Error("Store name not set"));
              return;
            }
            const transaction = db.transaction(this.storeName, "readonly");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.count();
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
              resolve(request.result);
              db.close();
            };
          });
        }
        async length() {
          return this.count();
        }
        async clear() {
          const db = await this.getDb();
          return new Promise((resolve, reject) => {
            if (!this.storeName) {
              reject(new Error("Store name not set"));
              return;
            }
            const transaction = db.transaction(this.storeName, "readwrite");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
              db.close();
              resolve();
            };
          });
        }
      };
      exports.default = IndexedDB;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/NearConnector.js
  var require_NearConnector = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/NearConnector.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.NearConnector = exports.DEFAULT_PROVIDERS = void 0;
      var events_1 = require_events();
      var NearWalletsPopup_1 = require_NearWalletsPopup();
      var storage_1 = require_storage();
      var indexdb_1 = __importDefault(require_indexdb());
      var ParentFrameWallet_1 = require_ParentFrameWallet();
      var InjectedWallet_1 = require_InjectedWallet();
      var SandboxedWallet_1 = require_SandboxedWallet();
      var defaultManifests = [
        "https://raw.githubusercontent.com/fastnear/near-connect/refs/heads/main/repository/manifest.json",
        "https://cdn.jsdelivr.net/gh/fastnear/near-connect/repository/manifest.json"
      ];
      exports.DEFAULT_PROVIDERS = {
        mainnet: ["https://rpc.mainnet.fastnear.com"],
        testnet: ["https://rpc.testnet.fastnear.com"]
      };
      function createFilterForWalletFeatures(features) {
        return (wallet) => {
          return Object.entries(features).every(([key, value]) => {
            if (value && !wallet.manifest.features?.[key])
              return false;
            return true;
          });
        };
      }
      __name(createFilterForWalletFeatures, "createFilterForWalletFeatures");
      var NearConnector2 = class {
        static {
          __name(this, "NearConnector");
        }
        storage;
        events;
        db;
        logger;
        wallets = [];
        manifest = { wallets: [], version: "1.0.0" };
        features = {};
        network = "mainnet";
        providers = { ...exports.DEFAULT_PROVIDERS };
        signInData;
        walletConnect;
        footerBranding;
        excludedWallets = [];
        autoConnect;
        whenManifestLoaded;
        constructor(options) {
          this.db = new indexdb_1.default("hot-connector", "wallets");
          this.storage = options?.storage ?? new storage_1.LocalStorage();
          this.events = options?.events ?? new events_1.EventEmitter();
          this.logger = options?.logger;
          this.network = options?.network ?? "mainnet";
          this.walletConnect = options?.walletConnect;
          this._migrateLegacySelectedWallet().catch(() => {
          });
          this.autoConnect = options?.autoConnect ?? true;
          this.providers = {
            ...exports.DEFAULT_PROVIDERS,
            ...options?.providers ?? {}
          };
          this.excludedWallets = options?.excludedWallets ?? [];
          this.features = options?.features ?? {};
          this.signInData = options?.signIn;
          this.footerBranding = options?.footerBranding ?? null;
          this.whenManifestLoaded = new Promise(async (resolve) => {
            if (options?.manifest == null || typeof options.manifest === "string") {
              this.manifest = await this._loadManifest(options?.manifest).catch(() => ({ wallets: [], version: "1.0.0" }));
            } else {
              this.manifest = options?.manifest ?? { wallets: [], version: "1.0.0" };
            }
            const set = new Set(this.excludedWallets);
            set.delete("hot-wallet");
            this.manifest.wallets = this.manifest.wallets.filter((wallet) => {
              if (wallet.permissions.walletConnect && !this.walletConnect)
                return false;
              if (set.has(wallet.id))
                return false;
              return true;
            });
            await new Promise((resolve2) => setTimeout(resolve2, 100));
            resolve();
          });
          if (typeof window !== "undefined") {
            window.addEventListener("near-wallet-injected", this._handleNearWalletInjected);
            window.dispatchEvent(new Event("near-selector-ready"));
            window.addEventListener("message", async (event) => {
              if (event.data.type === "near-wallet-injected") {
                await this.whenManifestLoaded.catch(() => {
                });
                this.wallets = this.wallets.filter((wallet) => wallet.manifest.id !== event.data.manifest.id);
                this.wallets.unshift(new ParentFrameWallet_1.ParentFrameWallet(this, event.data.manifest));
                this.events.emit("selector:walletsChanged", {});
                if (this.autoConnect) {
                  this.connect({ walletId: event.data.manifest.id });
                }
              }
            });
          }
          this.whenManifestLoaded.then(() => {
            if (typeof window !== "undefined") {
              window.parent.postMessage({ type: "near-selector-ready" }, "*");
            }
            this.manifest.wallets.forEach((wallet) => this.registerWallet(wallet));
            this.storage.get("debug-wallets").then((json) => {
              const debugWallets = JSON.parse(json ?? "[]");
              debugWallets.forEach((wallet) => this.registerDebugWallet(wallet));
            });
          });
        }
        get availableWallets() {
          const wallets = this.wallets.filter((wallet) => {
            return Object.entries(this.features).every(([key, value]) => {
              if (value && !wallet.manifest.features?.[key])
                return false;
              return true;
            });
          });
          return wallets.filter((wallet) => {
            if (this.network === "testnet" && !wallet.manifest.features?.testnet)
              return false;
            return true;
          });
        }
        _handleNearWalletInjected = /* @__PURE__ */ __name((event) => {
          this.wallets = this.wallets.filter((wallet) => wallet.manifest.id !== event.detail.manifest.id);
          this.wallets.unshift(new InjectedWallet_1.InjectedWallet(this, event.detail));
          this.events.emit("selector:walletsChanged", {});
        }, "_handleNearWalletInjected");
        async _loadManifest(manifestUrl) {
          const manifestEndpoints = manifestUrl ? [manifestUrl] : defaultManifests;
          for (const endpoint of manifestEndpoints) {
            const res = await fetch(endpoint).catch(() => null);
            if (!res || !res.ok)
              continue;
            return await res.json();
          }
          throw new Error("Failed to load manifest");
        }
        async switchNetwork(network, signInData) {
          if (this.network === network)
            return;
          await this.disconnect().catch(() => {
          });
          if (signInData)
            this.signInData = signInData;
          this.network = network;
          await this.connect();
        }
        async registerWallet(manifest) {
          if (manifest.type !== "sandbox")
            throw new Error("Only sandbox wallets are supported");
          if (this.wallets.find((wallet) => wallet.manifest.id === manifest.id))
            return;
          this.wallets.push(new SandboxedWallet_1.SandboxWallet(this, manifest));
          this.events.emit("selector:walletsChanged", {});
        }
        async registerDebugWallet(json) {
          const manifest = typeof json === "string" ? JSON.parse(json) : json;
          if (manifest.type !== "sandbox")
            throw new Error("Only sandbox wallets type are supported");
          if (!manifest.id)
            throw new Error("Manifest must have an id");
          if (!manifest.name)
            throw new Error("Manifest must have a name");
          if (!manifest.icon)
            throw new Error("Manifest must have an icon");
          if (!manifest.website)
            throw new Error("Manifest must have a website");
          if (!manifest.version)
            throw new Error("Manifest must have a version");
          if (!manifest.executor)
            throw new Error("Manifest must have an executor");
          if (!manifest.features)
            throw new Error("Manifest must have features");
          if (!manifest.permissions)
            throw new Error("Manifest must have permissions");
          if (this.wallets.find((wallet) => wallet.manifest.id === manifest.id))
            throw new Error("Wallet already registered");
          manifest.debug = true;
          this.wallets.unshift(new SandboxedWallet_1.SandboxWallet(this, manifest));
          this.events.emit("selector:walletsChanged", {});
          const debugWallets = this.wallets.filter((wallet) => wallet.manifest.debug).map((wallet) => wallet.manifest);
          this.storage.set("debug-wallets", JSON.stringify(debugWallets));
          return manifest;
        }
        async removeDebugWallet(id) {
          this.wallets = this.wallets.filter((wallet) => wallet.manifest.id !== id);
          const debugWallets = this.wallets.filter((wallet) => wallet.manifest.debug).map((wallet) => wallet.manifest);
          this.storage.set("debug-wallets", JSON.stringify(debugWallets));
          this.events.emit("selector:walletsChanged", {});
        }
        async selectWallet({ features = {} } = {}) {
          await this.whenManifestLoaded.catch(() => {
          });
          return new Promise((resolve, reject) => {
            const popup = new NearWalletsPopup_1.NearWalletsPopup({
              footer: this.footerBranding,
              wallets: this.availableWallets.filter(createFilterForWalletFeatures(features)).map((wallet) => wallet.manifest),
              onRemoveDebugManifest: /* @__PURE__ */ __name(async (id) => this.removeDebugWallet(id), "onRemoveDebugManifest"),
              onAddDebugManifest: /* @__PURE__ */ __name(async (wallet) => this.registerDebugWallet(wallet), "onAddDebugManifest"),
              onReject: /* @__PURE__ */ __name(() => (reject(new Error("User rejected")), popup.destroy()), "onReject"),
              onSelect: /* @__PURE__ */ __name((id) => (resolve(id), popup.destroy()), "onSelect")
            });
            popup.create();
          });
        }
        /**
         * Per-network localStorage key for the user's last picked wallet.
         * `${network}` segment lets a page hold parallel mainnet+testnet sessions
         * without one's pick clobbering the other.
         */
        selectedWalletKey() {
          return `selected-wallet:${this.network}`;
        }
        async _migrateLegacySelectedWallet() {
          const legacy = await this.storage.get("selected-wallet").catch(() => null);
          if (!legacy)
            return;
          const existing = await this.storage.get(`selected-wallet:mainnet`).catch(() => null);
          if (!existing) {
            await this.storage.set(`selected-wallet:mainnet`, legacy).catch(() => {
            });
          }
          await this.storage.remove("selected-wallet").catch(() => {
          });
        }
        async connect(input = {}) {
          let walletId = input.walletId;
          const signMessageParams = input.signMessageParams;
          await this.whenManifestLoaded.catch(() => {
          });
          if (!walletId)
            walletId = await this.selectWallet(input.signMessageParams != null ? { features: { signInAndSignMessage: true } } : void 0);
          try {
            const wallet = await this.wallet(walletId);
            this.logger?.log(`Wallet available to connect`, wallet);
            await this.storage.set(this.selectedWalletKey(), walletId);
            this.logger?.log(`Set preferred wallet, try to signIn${signMessageParams != null ? " (with signed message)" : ""}`, walletId);
            if (signMessageParams != null) {
              const accounts = await wallet.signInAndSignMessage({
                contractId: this.signInData?.contractId,
                methodNames: this.signInData?.methodNames,
                messageParams: signMessageParams,
                network: this.network
              });
              if (!accounts?.length)
                throw new Error("Failed to sign in");
              this.logger?.log(`Signed in to wallet (with signed message)`, walletId, accounts);
              this.events.emit("wallet:signInAndSignMessage", { wallet, accounts, success: true });
              this.events.emit("wallet:signIn", {
                wallet,
                accounts: accounts.map((account) => ({
                  accountId: account.accountId,
                  publicKey: account.publicKey
                })),
                success: true,
                source: "signInAndSignMessage"
              });
            } else {
              const accounts = await wallet.signIn({
                contractId: this.signInData?.contractId,
                methodNames: this.signInData?.methodNames,
                network: this.network
              });
              if (!accounts?.length)
                throw new Error("Failed to sign in");
              this.logger?.log(`Signed in to wallet`, walletId, accounts);
              this.events.emit("wallet:signIn", { wallet, accounts, success: true, source: "signIn" });
            }
            return wallet;
          } catch (e) {
            this.logger?.log("Failed to connect to wallet", e);
            throw e;
          }
        }
        async disconnect(wallet) {
          if (!wallet)
            wallet = await this.wallet();
          await wallet.signOut({ network: this.network });
          await this.storage.remove(this.selectedWalletKey());
          this.events.emit("wallet:signOut", { success: true });
        }
        async getConnectedWallet() {
          await this.whenManifestLoaded.catch(() => {
          });
          const id = await this.storage.get(this.selectedWalletKey());
          const wallet = this.wallets.find((wallet2) => wallet2.manifest.id === id);
          if (!wallet)
            throw new Error("No wallet selected");
          const accounts = await wallet.getAccounts();
          if (!accounts?.length)
            throw new Error("No accounts found");
          return { wallet, accounts };
        }
        async wallet(id) {
          await this.whenManifestLoaded.catch(() => {
          });
          if (!id) {
            return this.getConnectedWallet().then(({ wallet: wallet2 }) => wallet2).catch(async () => {
              await this.storage.remove(this.selectedWalletKey());
              throw new Error("No accounts found");
            });
          }
          const wallet = this.wallets.find((wallet2) => wallet2.manifest.id === id);
          if (!wallet)
            throw new Error("Wallet not found");
          return wallet;
        }
        async use(plugin) {
          await this.whenManifestLoaded.catch(() => {
          });
          this.wallets = this.wallets.map((wallet) => {
            return new Proxy(wallet, {
              get(target, prop, receiver) {
                const originalValue = Reflect.get(target, prop, receiver);
                if (prop in plugin && typeof originalValue === "function") {
                  const pluginMethod = plugin[prop];
                  return function(...args) {
                    const next = /* @__PURE__ */ __name(() => originalValue.apply(target, args), "next");
                    return args.length > 0 ? pluginMethod.call(this, ...args, next) : pluginMethod.call(this, void 0, next);
                  };
                }
                return originalValue;
              }
            });
          });
        }
        async addFunctionCallKey(params) {
          const wallet = await this.wallet();
          const accounts = await wallet.getAccounts({ network: params.network || this.network });
          if (!accounts?.length)
            throw new Error("Not signed in");
          const signerId = params.signerId || accounts[0].accountId;
          return wallet.addFunctionCallKey({ ...params, signerId, network: params.network || this.network });
        }
        on(event, callback) {
          this.events.on(event, callback);
        }
        once(event, callback) {
          this.events.once(event, callback);
        }
        off(event, callback) {
          this.events.off(event, callback);
        }
        removeAllListeners(event) {
          this.events.removeAllListeners(event);
        }
      };
      exports.NearConnector = NearConnector2;
    }
  });

  // ../../node_modules/@fastnear/near-connect/build/index.js
  var require_build = __commonJS({
    "../../node_modules/@fastnear/near-connect/build/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.nearActionsToConnectorActions = exports.NearConnector = exports.InjectedWallet = exports.SandboxWallet = exports.ParentFrameWallet = exports.LocalStorage = void 0;
      var storage_1 = require_storage();
      Object.defineProperty(exports, "LocalStorage", { enumerable: true, get: /* @__PURE__ */ __name(function() {
        return storage_1.LocalStorage;
      }, "get") });
      var ParentFrameWallet_1 = require_ParentFrameWallet();
      Object.defineProperty(exports, "ParentFrameWallet", { enumerable: true, get: /* @__PURE__ */ __name(function() {
        return ParentFrameWallet_1.ParentFrameWallet;
      }, "get") });
      var SandboxedWallet_1 = require_SandboxedWallet();
      Object.defineProperty(exports, "SandboxWallet", { enumerable: true, get: /* @__PURE__ */ __name(function() {
        return SandboxedWallet_1.SandboxWallet;
      }, "get") });
      var InjectedWallet_1 = require_InjectedWallet();
      Object.defineProperty(exports, "InjectedWallet", { enumerable: true, get: /* @__PURE__ */ __name(function() {
        return InjectedWallet_1.InjectedWallet;
      }, "get") });
      var NearConnector_1 = require_NearConnector();
      Object.defineProperty(exports, "NearConnector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
        return NearConnector_1.NearConnector;
      }, "get") });
      var actions_1 = require_actions();
      Object.defineProperty(exports, "nearActionsToConnectorActions", { enumerable: true, get: /* @__PURE__ */ __name(function() {
        return actions_1.nearActionsToConnectorActions;
      }, "get") });
    }
  });

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    accountId: () => accountId,
    addFunctionCallKey: () => addFunctionCallKey,
    availableWallets: () => availableWallets,
    connect: () => connect,
    disconnect: () => disconnect,
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

  // src/connector.ts
  var import_near_connect = __toESM(require_build(), 1);

  // ../borsh/src/index.ts
  var EncodeBuffer = class {
    static {
      __name(this, "EncodeBuffer");
    }
    offset = 0;
    bufferSize = 256;
    buffer = new ArrayBuffer(this.bufferSize);
    view = new DataView(this.buffer);
    resize(needed) {
      if (this.bufferSize - this.offset < needed) {
        this.bufferSize = Math.max(this.bufferSize * 2, this.bufferSize + needed);
        const next = new ArrayBuffer(this.bufferSize);
        new Uint8Array(next).set(new Uint8Array(this.buffer));
        this.buffer = next;
        this.view = new DataView(next);
      }
    }
    storeU8(v) {
      this.resize(1);
      this.view.setUint8(this.offset, v);
      this.offset += 1;
    }
    storeU16(v) {
      this.resize(2);
      this.view.setUint16(this.offset, v, true);
      this.offset += 2;
    }
    storeU32(v) {
      this.resize(4);
      this.view.setUint32(this.offset, v, true);
      this.offset += 4;
    }
    storeBytes(from) {
      this.resize(from.length);
      new Uint8Array(this.buffer).set(from, this.offset);
      this.offset += from.length;
    }
    result() {
      return new Uint8Array(this.buffer).slice(0, this.offset);
    }
  };
  var DecodeBuffer = class {
    static {
      __name(this, "DecodeBuffer");
    }
    offset = 0;
    view;
    bytes;
    constructor(buf) {
      const ab = new ArrayBuffer(buf.length);
      new Uint8Array(ab).set(buf);
      this.view = new DataView(ab);
      this.bytes = new Uint8Array(ab);
    }
    assert(size) {
      if (this.offset + size > this.bytes.length) {
        throw new Error("Borsh: buffer overrun");
      }
    }
    readU8() {
      this.assert(1);
      const v = this.view.getUint8(this.offset);
      this.offset += 1;
      return v;
    }
    readU16() {
      this.assert(2);
      const v = this.view.getUint16(this.offset, true);
      this.offset += 2;
      return v;
    }
    readU32() {
      this.assert(4);
      const v = this.view.getUint32(this.offset, true);
      this.offset += 4;
      return v;
    }
    readBytes(len) {
      this.assert(len);
      const slice = this.bytes.slice(this.offset, this.offset + len);
      this.offset += len;
      return slice;
    }
  };
  function encodeBigint(buf, value, byteLen) {
    const out = new Uint8Array(byteLen);
    let v = value;
    for (let i = 0; i < byteLen; i++) {
      out[i] = Number(v & 0xffn);
      v >>= 8n;
    }
    buf.storeBytes(out);
  }
  __name(encodeBigint, "encodeBigint");
  function decodeBigint(buf, byteLen) {
    const bytes = buf.readBytes(byteLen);
    const hex = bytes.reduceRight((r, x) => r + x.toString(16).padStart(2, "0"), "");
    return BigInt("0x" + hex);
  }
  __name(decodeBigint, "decodeBigint");
  function utf8Encode(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 128) {
        bytes.push(c);
      } else if (c < 2048) {
        bytes.push(192 | c >> 6, 128 | c & 63);
      } else if (c < 55296 || c >= 57344) {
        bytes.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
      } else {
        i++;
        c = 65536 + ((c & 1023) << 10 | str.charCodeAt(i) & 1023);
        bytes.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
      }
    }
    return new Uint8Array(bytes);
  }
  __name(utf8Encode, "utf8Encode");
  function utf8Decode(bytes) {
    const codePoints = [];
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b < 128) {
        codePoints.push(b);
      } else if (b < 224) {
        codePoints.push((b & 31) << 6 | bytes[++i] & 63);
      } else if (b < 240) {
        codePoints.push((b & 15) << 12 | (bytes[++i] & 63) << 6 | bytes[++i] & 63);
      } else {
        codePoints.push((b & 7) << 18 | (bytes[++i] & 63) << 12 | (bytes[++i] & 63) << 6 | bytes[++i] & 63);
      }
    }
    return String.fromCodePoint(...codePoints);
  }
  __name(utf8Decode, "utf8Decode");
  function encodeValue(buf, value, schema) {
    if (typeof schema === "string") {
      switch (schema) {
        case "u8":
          return buf.storeU8(value);
        case "u16":
          return buf.storeU16(value);
        case "u32":
          return buf.storeU32(value);
        case "u64":
          return encodeBigint(buf, BigInt(value), 8);
        case "u128":
          return encodeBigint(buf, BigInt(value), 16);
        case "string": {
          const encoded = utf8Encode(value);
          buf.storeU32(encoded.length);
          buf.storeBytes(encoded);
          return;
        }
      }
    }
    if (typeof schema === "object") {
      if ("option" in schema) {
        if (value === null || value === void 0) {
          buf.storeU8(0);
        } else {
          buf.storeU8(1);
          encodeValue(buf, value, schema.option);
        }
        return;
      }
      if ("enum" in schema) {
        const valueKey = Object.keys(value)[0];
        const variants = schema.enum;
        for (let i = 0; i < variants.length; i++) {
          const variantKey = Object.keys(variants[i].struct)[0];
          if (valueKey === variantKey) {
            buf.storeU8(i);
            encodeStruct(buf, value, variants[i]);
            return;
          }
        }
        throw new Error(`Borsh: enum key "${valueKey}" not found in schema`);
      }
      if ("array" in schema) {
        if (schema.array.len == null) {
          buf.storeU32(value.length);
        }
        for (let i = 0; i < value.length; i++) {
          encodeValue(buf, value[i], schema.array.type);
        }
        return;
      }
      if ("struct" in schema) {
        encodeStruct(buf, value, schema);
        return;
      }
    }
  }
  __name(encodeValue, "encodeValue");
  function encodeStruct(buf, value, schema) {
    for (const key of Object.keys(schema.struct)) {
      encodeValue(buf, value[key], schema.struct[key]);
    }
  }
  __name(encodeStruct, "encodeStruct");
  function decodeValue(buf, schema) {
    if (typeof schema === "string") {
      switch (schema) {
        case "u8":
          return buf.readU8();
        case "u16":
          return buf.readU16();
        case "u32":
          return buf.readU32();
        case "u64":
          return decodeBigint(buf, 8);
        case "u128":
          return decodeBigint(buf, 16);
        case "string": {
          const len = buf.readU32();
          return utf8Decode(buf.readBytes(len));
        }
      }
    }
    if (typeof schema === "object") {
      if ("option" in schema) {
        const flag = buf.readU8();
        if (flag === 1) return decodeValue(buf, schema.option);
        if (flag === 0) return null;
        throw new Error(`Borsh: invalid option flag ${flag}`);
      }
      if ("enum" in schema) {
        const idx = buf.readU8();
        if (idx >= schema.enum.length) {
          throw new Error(`Borsh: enum index ${idx} out of range`);
        }
        const variant = schema.enum[idx];
        const result = {};
        for (const key of Object.keys(variant.struct)) {
          result[key] = decodeValue(buf, variant.struct[key]);
        }
        return result;
      }
      if ("array" in schema) {
        const len = schema.array.len ?? buf.readU32();
        const result = [];
        for (let i = 0; i < len; i++) {
          result.push(decodeValue(buf, schema.array.type));
        }
        return result;
      }
      if ("struct" in schema) {
        const result = {};
        for (const key in schema.struct) {
          result[key] = decodeValue(buf, schema.struct[key]);
        }
        return result;
      }
    }
    throw new Error(`Borsh: unsupported schema: ${JSON.stringify(schema)}`);
  }
  __name(decodeValue, "decodeValue");
  function serialize(schema, value) {
    const buf = new EncodeBuffer();
    encodeValue(buf, value, schema);
    return buf.result();
  }
  __name(serialize, "serialize");
  function deserialize(schema, buffer) {
    const buf = new DecodeBuffer(buffer);
    return decodeValue(buf, schema);
  }
  __name(deserialize, "deserialize");

  // ../borsh-schema/src/index.ts
  var nearChainSchema = new class BorshSchema {
    static {
      __name(this, "BorshSchema");
    }
    Ed25519Signature = {
      struct: {
        data: { array: { type: "u8", len: 64 } }
      }
    };
    Secp256k1Signature = {
      struct: {
        data: { array: { type: "u8", len: 65 } }
      }
    };
    Signature = {
      enum: [
        { struct: { ed25519Signature: this.Ed25519Signature } },
        { struct: { secp256k1Signature: this.Secp256k1Signature } }
      ]
    };
    Ed25519Data = {
      struct: {
        data: { array: { type: "u8", len: 32 } }
      }
    };
    Secp256k1Data = {
      struct: {
        data: { array: { type: "u8", len: 64 } }
      }
    };
    PublicKey = {
      enum: [
        { struct: { ed25519Key: this.Ed25519Data } },
        { struct: { secp256k1Key: this.Secp256k1Data } }
      ]
    };
    FunctionCallPermission = {
      struct: {
        allowance: { option: "u128" },
        receiverId: "string",
        methodNames: { array: { type: "string" } }
      }
    };
    FullAccessPermission = {
      struct: {}
    };
    AccessKeyPermission = {
      enum: [
        { struct: { functionCall: this.FunctionCallPermission } },
        { struct: { fullAccess: this.FullAccessPermission } }
      ]
    };
    AccessKey = {
      struct: {
        nonce: "u64",
        permission: this.AccessKeyPermission
      }
    };
    CreateAccount = {
      struct: {}
    };
    DeployContract = {
      struct: {
        code: { array: { type: "u8" } }
      }
    };
    FunctionCall = {
      struct: {
        methodName: "string",
        args: { array: { type: "u8" } },
        gas: "u64",
        deposit: "u128"
      }
    };
    Transfer = {
      struct: {
        deposit: "u128"
      }
    };
    Stake = {
      struct: {
        stake: "u128",
        publicKey: this.PublicKey
      }
    };
    AddKey = {
      struct: {
        publicKey: this.PublicKey,
        accessKey: this.AccessKey
      }
    };
    DeleteKey = {
      struct: {
        publicKey: this.PublicKey
      }
    };
    DeleteAccount = {
      struct: {
        beneficiaryId: "string"
      }
    };
    ClassicAction = {
      enum: [
        { struct: { createAccount: this.CreateAccount } },
        { struct: { deployContract: this.DeployContract } },
        { struct: { functionCall: this.FunctionCall } },
        { struct: { transfer: this.Transfer } },
        { struct: { stake: this.Stake } },
        { struct: { addKey: this.AddKey } },
        { struct: { deleteKey: this.DeleteKey } },
        { struct: { deleteAccount: this.DeleteAccount } }
      ]
    };
    DelegateAction = {
      struct: {
        senderId: "string",
        receiverId: "string",
        actions: { array: { type: this.ClassicAction } },
        nonce: "u64",
        maxBlockHeight: "u64",
        publicKey: this.PublicKey
      }
    };
    SignedDelegate = {
      struct: {
        delegateAction: this.DelegateAction,
        signature: this.Signature
      }
    };
    Action = {
      enum: [
        { struct: { createAccount: this.CreateAccount } },
        { struct: { deployContract: this.DeployContract } },
        { struct: { functionCall: this.FunctionCall } },
        { struct: { transfer: this.Transfer } },
        { struct: { stake: this.Stake } },
        { struct: { addKey: this.AddKey } },
        { struct: { deleteKey: this.DeleteKey } },
        { struct: { deleteAccount: this.DeleteAccount } },
        { struct: { signedDelegate: this.SignedDelegate } }
      ]
    };
    Transaction = {
      struct: {
        signerId: "string",
        publicKey: this.PublicKey,
        nonce: "u64",
        receiverId: "string",
        blockHash: { array: { type: "u8", len: 32 } },
        actions: { array: { type: this.Action } }
      }
    };
    SignedTransaction = {
      struct: {
        transaction: this.Transaction,
        signature: this.Signature
      }
    };
  }();

  // src/connector.ts
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
        signedDelegate = deserialize(nearChainSchema.SignedDelegate, bytes);
      } catch (err) {
        throw new Error(
          `Failed to borsh-deserialize signedDelegateAction at index ${index}: ${err}`
        );
      }
      const delegateActionBytes = serialize(
        nearChainSchema.DelegateAction,
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
        signedDelegate = deserialize(nearChainSchema.SignedDelegate, bytes);
      } catch (err) {
        throw new Error(
          `Failed to borsh-deserialize signedDelegate at index ${index}: ${err}`
        );
      }
      let delegateHash = raw.delegateHash;
      if (!delegateHash) {
        const delegateActionBytes = serialize(
          nearChainSchema.DelegateAction,
          signedDelegate.delegateAction
        );
        delegateHash = await sha256(delegateActionBytes);
      }
      return { delegateHash, signedDelegate };
    }
    return raw;
  }
  __name(normalizeSignedDelegateAction, "normalizeSignedDelegateAction");
  var NETWORKS = ["mainnet", "testnet"];
  var networkStates = {
    mainnet: { connector: null, connectedWallet: null, currentAccountId: null },
    testnet: { connector: null, connectedWallet: null, currentAccountId: null }
  };
  var activeNetwork = "mainnet";
  var connectListeners = [];
  var disconnectListeners = [];
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
  return __toCommonJS(src_exports);
})();

try {
  Object.defineProperty(globalThis, 'nearWallet', {
    value: nearWallet,
    enumerable: true,
    configurable: false,
  });
} catch (error) {
  console.error('Could not define global "nearWallet" object', error);
  throw error;
}

// Auto-wire with @fastnear/api if it loaded first
if (typeof globalThis.near !== 'undefined' && globalThis.near.useWallet) {
  globalThis.near.useWallet(nearWallet);
}

//# sourceMappingURL=browser.global.js.map
