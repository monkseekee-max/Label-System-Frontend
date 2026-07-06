import type { ThemeConfig } from "antd";

import { fontSize, radius, spacing } from "#src/styles/tokens";

/**
 * Token-derived Ant Design theme overrides (light).
 *
 * Colors stay driven by ConfigProvider `token.colorPrimary` / user preference
 * in app.tsx; here we centralize the structural tokens (radius, font sizes,
 * control sizing) so the design-token system is the single source of truth.
 *
 * @see https://ant.design/docs/react/customize-theme
 */
export const customAntdLightTheme: ThemeConfig = {
	token: {
		borderRadius: radius.base,
		borderRadiusSM: radius.sm,
		borderRadiusLG: radius.lg,
		fontSize: fontSize.base,
		fontSizeSM: fontSize.sm,
		fontSizeLG: fontSize.lg,
		fontSizeHeading1: fontSize["5xl"],
		fontSizeHeading2: fontSize["4xl"],
		fontSizeHeading3: fontSize["3xl"],
		fontSizeHeading4: fontSize["2xl"],
		fontSizeHeading5: fontSize.xl,
		controlHeight: spacing["2xl"],
		controlHeightSM: spacing.xl,
		controlHeightLG: spacing["3xl"],
	},
	components: {
		Card: {
			borderRadiusLG: radius.lg,
		},
		Modal: {
			borderRadiusLG: radius.lg,
		},
		Button: {
			borderRadius: radius.base,
			controlHeight: spacing["2xl"],
		},
	},
};

/**
 * Token-derived Ant Design theme overrides (dark).
 *
 * Mirrors the light structural tokens; color algorithm is selected at the
 * ConfigProvider level (darkAlgorithm). Shadow tokens adapt automatically via
 * the `.dark` CSS-variable overrides in tokens.css.
 */
export const customAntdDarkTheme: ThemeConfig = {
	token: {
		...customAntdLightTheme.token,
	},
	components: {
		...customAntdLightTheme.components,
	},
};
