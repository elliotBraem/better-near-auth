# @fastnear/borsh

Lean [Borsh](https://borsh.io/) serializer/deserializer for NEAR Protocol. Zero dependencies.

API-compatible with the [`borsh`](https://www.npmjs.com/package/borsh) npm package for the subset of schemas NEAR uses.

## Supported types

`u8`, `u16`, `u32`, `u64`, `u128`, `string`, `struct`, `enum`, `array` (fixed + dynamic), `option`

## Install

```bash
npm install @fastnear/borsh
```

## Usage

```js
import { serialize, deserialize } from "@fastnear/borsh";

const schema = { struct: { name: "string", age: "u8" } };

const encoded = serialize(schema, { name: "Alice", age: 30 });
const decoded = deserialize(schema, encoded);
```

## Browser (IIFE)

```html
<script src="https://cdn.jsdelivr.net/npm/@fastnear/borsh/dist/umd/browser.global.js"></script>
<script>
  // Available as window.NearBorsh
  const { serialize, deserialize } = NearBorsh;
</script>
```

## Part of the FastNear JS monorepo

See the [project-level README](https://github.com/fastnear/js-monorepo) for more info.
