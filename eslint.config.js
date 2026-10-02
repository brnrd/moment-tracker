import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import prettier from 'eslint-config-prettier'

export default [
	{ ignores: ['dist/**', '.astro/**', 'node_modules/**'] },
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	{
		languageOptions: {
			globals: Object.fromEntries(
				[
					'crypto',
					'localStorage',
					'document',
					'window',
					'navigator',
					'console',
					'setTimeout',
					'setInterval',
					'clearInterval',
					'TextEncoder',
					'TextDecoder',
					'btoa',
					'atob',
					'Blob',
					'URL'
				].map((name) => [name, 'readonly'])
			)
		},
		rules: { 'no-unused-vars': 'warn', 'no-console': 'warn' }
	}
]
