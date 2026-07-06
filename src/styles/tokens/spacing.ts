/**
 * Spacing scale design tokens.
 *
 * Centralized so layout/padding/margin values are consistent and themeable.
 * CSS variables (prefixed `--app-`) are emitted on `:root` via tokens.css;
 * TS constants mirror them for use in inline styles / JS calculations.
 *
 * Migration target: replace ad-hoc `padding: 16`, `marginBottom: 24` etc. with
 * `spacing[4]` / `var(--app-space-4)`.
 */
export const spacing = {
	"xs": 4,
	"sm": 8,
	"md": 12,
	"base": 16,
	"lg": 20,
	"xl": 24,
	"2xl": 32,
	"3xl": 40,
	"4xl": 48,
	"5xl": 64,
} as const;

export type SpacingToken = keyof typeof spacing;
