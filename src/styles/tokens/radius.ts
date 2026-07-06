/**
 * Border-radius scale design tokens.
 *
 * `base` (6px) aligns with AntD 6 `controlRadius`. The effective radius is
 * still overridable at runtime via the user's `themeRadius` preference
 * (see `src/app.tsx` ConfigProvider token.borderRadius), but this scale
 * governs non-AntD / custom components.
 */
export const radius = {
	none: 0,
	xs: 2,
	sm: 4,
	base: 6,
	md: 8,
	lg: 12,
	xl: 16,
	full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
