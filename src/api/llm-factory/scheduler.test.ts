/**
 * scheduler API 派生函数单测.
 * 锁住前后端 mode 互转契约 (semi ↔ semi_auto), 防止调度模式错乱.
 */
import { describe, expect, it } from "vitest";

import { MODE_COLORS, MODE_LABELS, toBackendMode, toFrontendMode } from "./scheduler";

describe("toFrontendMode", () => {
	it("semi_auto → semi", () => {
		expect(toFrontendMode("semi_auto")).toBe("semi");
	});
	it("auto / manual 原样", () => {
		expect(toFrontendMode("auto")).toBe("auto");
		expect(toFrontendMode("manual")).toBe("manual");
	});
});

describe("toBackendMode", () => {
	it("semi → semi_auto", () => {
		expect(toBackendMode("semi")).toBe("semi_auto");
	});
	it("auto / manual 原样", () => {
		expect(toBackendMode("auto")).toBe("auto");
		expect(toBackendMode("manual")).toBe("manual");
	});
});

describe("mode 互转可逆", () => {
	it("toBackendMode(toFrontendMode(x)) === x (三种后端模式)", () => {
		for (const m of ["manual", "semi_auto", "auto"]) {
			expect(toBackendMode(toFrontendMode(m))).toBe(m);
		}
	});
});

describe("mode 标签与颜色完整覆盖三种前端模式", () => {
	it("三种模式都有标签和颜色", () => {
		for (const m of ["auto", "semi", "manual"] as const) {
			expect(MODE_LABELS[m]).toBeTruthy();
			expect(MODE_COLORS[m]).toBeTruthy();
		}
	});
});
