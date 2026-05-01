/* ⋈ 🏃🏻💨 FastNear Borsh Schema - IIFE/UMD (@fastnear/borsh-schema version 1.2.0) */
/* https://www.npmjs.com/package/@fastnear/borsh-schema/v/1.2.0 */
"use strict";
var NearBorshSchema = (() => {
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

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    getBorshSchema: () => getBorshSchema,
    nearChainSchema: () => nearChainSchema
  });
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
  var getBorshSchema = /* @__PURE__ */ __name(() => nearChainSchema, "getBorshSchema");
  return __toCommonJS(src_exports);
})();

Object.defineProperty(globalThis, 'NearBorshSchema', {
  value: NearBorshSchema,
  enumerable: true,
  configurable: false,
});

//# sourceMappingURL=browser.global.js.map