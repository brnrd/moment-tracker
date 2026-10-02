/** @type {import('prettier').Config} */
export default {
	useTabs: true,
	semi: false,
	singleQuote: true,
	trailingComma: 'none',
	svelteSortOrder: 'options-scripts-markup-styles',
	svelteStrictMode: true,
	svelteBracketNewLine: true,
	svelteAllowShorthand: true,
	printWidth: 100,
	plugins: ['prettier-plugin-svelte'],
	overrides: [
		{
			files: '*.svelte',
			options: {
				parser: 'svelte',
				semi: false
			}
		}
	]
}
