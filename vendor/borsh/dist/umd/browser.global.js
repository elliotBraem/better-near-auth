/* ⋈ 🏃🏻💨 FastNear Borsh - IIFE/UMD (@fastnear/borsh version 1.2.0) */
/* https://www.npmjs.com/package/@fastnear/borsh/v/1.2.0 */
"use strict";
var NearBorsh = (() => {
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
    deserialize: () => deserialize,
    serialize: () => serialize
  });
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
  return __toCommonJS(src_exports);
})();

Object.defineProperty(globalThis, 'NearBorsh', {
  value: NearBorsh,
  enumerable: true,
  configurable: false,
});

//# sourceMappingURL=browser.global.js.map