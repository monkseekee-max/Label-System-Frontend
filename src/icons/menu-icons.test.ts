import { describe, expect, it } from "vitest";

import { menuIcons } from "./menu-icons";

/**
 * Regression guard for the menu icon registry (audit finding C4):
 * - the map must remain non-empty and stable
 * - every value must be a renderable React component (a function)
 * - every key must be a non-empty string
 *
 * The static type-safety (no `any`) is enforced separately via `tsc --noEmit`
 * and the `Record<string, ComponentType>` annotation in menu-icons.ts.
 */
describe("menuIcons registry", () => {
	it("is a non-empty object", () => {
		expect(typeof menuIcons).toBe("object");
		expect(menuIcons).not.toBeNull();
		expect(Object.keys(menuIcons).length).toBeGreaterThan(0);
	});

	it("only contains non-empty string keys", () => {
		for (const key of Object.keys(menuIcons)) {
			expect(typeof key).toBe("string");
			expect(key.length).toBeGreaterThan(0);
		}
	});

	/**
	 * React components can be either functions (function components) or
	 * non-null objects (forwardRef / memoized components — e.g. every
	 * `@ant-design/icons` *Outlined icon reports as "object"). Both are
	 * valid `ComponentType` values and renderable via `createElement`.
	 */
	function isRenderable(value: unknown): boolean {
		return typeof value === "function" || (typeof value === "object" && value !== null);
	}

	it("only contains renderable React component values", () => {
		for (const value of Object.values(menuIcons)) {
			expect(isRenderable(value)).toBe(true);
		}
	});

	it("registers the known core icons used across routes", () => {
		// A representative subset — guards against accidental removal.
		expect(isRenderable(menuIcons.HomeOutlined)).toBe(true);
		expect(isRenderable(menuIcons.SettingOutlined)).toBe(true);
		expect(isRenderable(menuIcons.UserOutlined)).toBe(true);
		expect(isRenderable(menuIcons.TeamOutlined)).toBe(true);
		expect(isRenderable(menuIcons.DashboardOutlined)).toBe(true);
	});
});
