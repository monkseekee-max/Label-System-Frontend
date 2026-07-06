import antfu from "@antfu/eslint-config";

export default antfu({
	react: true,
	ignores: [
		"docs/**",
		"src/router/README.md",
		"src/store/preferences/types.ts",
		"src/components/image-annotator/**",
		"src/layout/layout-tabbar/hooks/use-dropdown-menu.tsx",
	],
	rules: {
		"style/quotes": ["error", "double"],
		"style/semi": ["error", "always"],
		"style/indent": ["error", "tab"],
		"jsonc/indent": ["error", "tab"],
		"style/no-tabs": "off",
		"style/jsx-indent-props": ["error", "tab"],
		"react-hooks/exhaustive-deps": "off",
	},
});
