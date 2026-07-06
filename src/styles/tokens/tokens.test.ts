import { describe, expect, it } from "vitest";

import { fontSize, fontWeight, lineHeight, radius, shadow, spacing } from "./index";

describe("design tokens", () => {
	it("exposes a stable spacing scale aligned to 4px base", () => {
		expect(spacing.xs).toBe(4);
		expect(spacing.base).toBe(16);
		expect(spacing["5xl"]).toBe(64);
	});

	it("exposes a typography scale with AntD-aligned base size", () => {
		expect(fontSize.base).toBe(14);
		expect(fontSize.md).toBe(16);
		expect(fontWeight.semibold).toBe(600);
		expect(lineHeight.relaxed).toBe(1.7);
	});

	it("exposes a radius scale with AntD-aligned control radius", () => {
		expect(radius.base).toBe(6);
		expect(radius.full).toBe(9999);
	});

	it("exposes a shadow scale with concrete box-shadow values", () => {
		expect(shadow.md).toContain("rgba(0,0,0");
		expect(shadow.xl.length).toBeGreaterThan(shadow.sm.length);
	});
});
