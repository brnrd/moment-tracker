/** @type {import('prettier').Config} */
module.exports = {
	useTabs: true,
	semi: false,
	singleQuote: true,
	trailingComma: 'none',
	svelteSortOrder: 'options-scripts-markup-styles',
	svelteStrictMode: false,
	svelteBracketNewLine: true,
	svelteAllowShorthand: true,
	printWidth: 100,
	plugins: ['prettier-plugin-svelte'],
	pluginSearchDirs: ['.'],
	overrides: [
		{
			files: '*.svelte',
			options: {
				parser: 'svelte',
				semi: false
			}
		}
	]
};