import { defineConfig } from 'tsdown'

const external = [/^near-kit/, /^better-auth/, '@scure/base', 'nanostores', 'zod']

export default defineConfig([
	{
		entry: ['src/index.ts'],
		format: 'esm',
		dts: false,
		sourcemap: true,
		hash: false,
		external,
	},
	{
		entry: ['src/client.ts'],
		format: 'esm',
		dts: false,
		sourcemap: true,
		hash: false,
		external,
		noExternal: /@hot-labs\/near-connect/,
		clean: false,
	},
])
