/**
 * Typography scale design tokens.
 *
 * Font sizes (px), line heights (unitless ratio), and font weights.
 * `base` size aligns with AntD 6 default (14px) for visual consistency.
 */
export const fontSize = {
	"xs": 12,
	"sm": 13,
	"base": 14,
	"md": 16,
	"lg": 18,
	"xl": 20,
	"2xl": 24,
	"3xl": 30,
	"4xl": 36,
	"5xl": 48,
} as const;

export const lineHeight = {
	tight: 1.2,
	snug: 1.4,
	base: 1.5,
	relaxed: 1.7,
	loose: 2,
} as const;

export const fontWeight = {
	normal: 400,
	medium: 500,
	semibold: 600,
	bold: 700,
} as const;

export type FontSizeToken = keyof typeof fontSize;
export type LineHeightToken = keyof typeof lineHeight;
export type FontWeightToken = keyof typeof fontWeight;
