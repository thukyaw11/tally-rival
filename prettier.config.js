// Shared base; apps/web adds the Svelte and Tailwind plugins on top.
/** @type {import("prettier").Config} */
const config = {
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	printWidth: 100
};

export default config;
