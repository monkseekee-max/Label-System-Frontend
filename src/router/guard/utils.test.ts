import { describe, expect, it } from "vitest";

import type { AppRouteRecordRaw } from "#src/router/types";

import { hasRouteAccessByRoles, removeDuplicateRoutes } from "./utils";

const mk = (over: Partial<AppRouteRecordRaw> = {}): AppRouteRecordRaw =>
	({ path: "/x", handle: { title: "x" }, ...over } as AppRouteRecordRaw);

describe("guard-utils", () => {
	it("returns true for routes without role requirements", () => {
		expect(hasRouteAccessByRoles(["ANNOTATOR"], undefined)).toBe(true);
		expect(hasRouteAccessByRoles(["ANNOTATOR"], [])).toBe(true);
	});

	it("returns false for unauthorized direct-link scenarios", () => {
		expect(hasRouteAccessByRoles(["ANNOTATOR"], ["REVIEWER"])).toBe(false);
		expect(hasRouteAccessByRoles(["REVIEWER"], ["ANNOTATOR"])).toBe(false);
	});

	it("allows admin hierarchy to pass protected route checks", () => {
		expect(hasRouteAccessByRoles(["ADMIN"], ["REVIEWER"])).toBe(true);
		expect(hasRouteAccessByRoles(["SUPER_ADMIN"], ["ADMIN"])).toBe(true);
	});

	describe("removeDuplicateRoutes", () => {
		it("drops second route with the same path", () => {
			const out = removeDuplicateRoutes([mk({ path: "/a" }), mk({ path: "/a" }), mk({ path: "/b" })]);
			expect(out).toHaveLength(2);
			expect(out.map(r => r.path)).toEqual(["/a", "/b"]);
		});

		it("keeps all pathless layout routes (menu groups) instead of deduping them as undefined-path duplicates", () => {
			// 五大业务分类均为 pathless 布局路由, path 为 undefined;
			// 旧实现会把第 2..N 个当作 "重复 undefined" 删除 → 分类丢失。
			const pathless = (menuKey: string): AppRouteRecordRaw =>
				({ handle: { title: menuKey, menuKey } } as AppRouteRecordRaw);
			const out = removeDuplicateRoutes([
				pathless("cat-enterprise"),
				pathless("cat-data"),
				pathless("cat-annotation"),
				pathless("cat-training"),
				pathless("cat-application"),
			]);
			expect(out).toHaveLength(5);
		});

		it("still dedupes pathful routes alongside pathless ones", () => {
			const pathless = (menuKey: string): AppRouteRecordRaw =>
				({ handle: { title: menuKey, menuKey } } as AppRouteRecordRaw);
			const out = removeDuplicateRoutes([
				pathless("cat-a"),
				pathless("cat-b"),
				mk({ path: "/dup" }),
				mk({ path: "/dup" }),
			]);
			expect(out.map(r => r.path ?? r.handle?.menuKey)).toEqual(["cat-a", "cat-b", "/dup"]);
		});
	});
});
