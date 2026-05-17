import { defineConfig } from 'tsdown'

const neverBundle = [/^near-kit/, /^better-auth/, '@scure/base', 'nanostores', 'zod']

export default defineConfig([
	{
		entry: ['src/index.ts'],
		format: 'esm',
		dts: false,
		sourcemap: true,
		hash: false,
		fixedExtension: false,
		deps: {
			neverBundle,
			onlyBundle: false,
		},
	},
	{
		entry: ['src/client.ts'],
		format: 'esm',
		dts: false,
		sourcemap: true,
		hash: false,
		fixedExtension: false,
		deps: {
			neverBundle,
			alwaysBundle: /@hot-labs\/near-connect/,
			onlyBundle: false,
		},
		clean: false,
	},
])
