import type { AppRouteRecordRaw } from "#src/router/types";

import { describe, expect, it } from "vitest";

import { generateMenuItemsFromRoutes } from "./generate-menu-items-from-routes";

const leaf = (path: string, title: string, extra: { hideInMenu?: boolean } = {}): AppRouteRecordRaw =>
	({
		path,
		Component: () => null,
		handle: { title, ...extra },
	}) as AppRouteRecordRaw;

describe("generateMenuItemsFromRoutes", () => {
	it("uses path as menu key for ordinary routes", () => {
		const menus = generateMenuItemsFromRoutes([leaf("/a", "A"), leaf("/b", "B")]);
		expect(menus.map(m => m.key)).toEqual(["/a", "/b"]);
	});

	it("hides routes flagged hideInMenu", () => {
		const menus = generateMenuItemsFromRoutes([leaf("/a", "A"), leaf("/b", "B", { hideInMenu: true })]);
		expect(menus).toHaveLength(1);
		expect(menus[0]!.key).toBe("/a");
	});

	it("renders pathless category parents (menu groups) using handle.menuKey and nests their children", () => {
		// 五大业务分类: pathless ContainerLayout, 跨前缀聚合叶子页 (/platform + /system + /llm-factory)
		const enterprise: AppRouteRecordRaw = {
			Component: () => null,
			handle: { title: "企业", menuKey: "cat-enterprise", order: 5 },
			children: [
				leaf("/platform/companies", "企业管理"),
				leaf("/system/user", "人员管理"),
				leaf("/llm-factory/billing", "计费中心"),
			],
		} as AppRouteRecordRaw;

		const menus = generateMenuItemsFromRoutes([enterprise]);
		expect(menus).toHaveLength(1);
		const group = menus[0]!;
		// 父级 key 回退到 menuKey (而非 undefined), 保证菜单唯一性
		expect(group.key).toBe("cat-enterprise");
		expect(group.label).toBe("企业");
		// 跨前缀叶子全部被聚合为该分组的子菜单
		expect(group.children?.map(c => c.key)).toEqual([
			"/platform/companies",
			"/system/user",
			"/llm-factory/billing",
		]);
	});

	it("renders nested pathless subgroups inside a category", () => {
		// 基础设施 子分组 (pathless ParentLayout) 嵌套在企业分类下
		const enterprise: AppRouteRecordRaw = {
			Component: () => null,
			handle: { title: "企业", menuKey: "cat-enterprise" },
			children: [
				leaf("/platform/companies", "企业管理"),
				{
					Component: () => null,
					handle: { title: "基础设施", menuKey: "grp-enterprise-infra" },
					children: [
						leaf("/llm-factory/infra/scheduler", "调度器"),
						leaf("/llm-factory/infra/gpu-monitor", "GPU 监控"),
					],
				} as AppRouteRecordRaw,
			],
		} as AppRouteRecordRaw;

		const menus = generateMenuItemsFromRoutes([enterprise]);
		const infra = menus[0]!.children?.find(c => c.key === "grp-enterprise-infra");
		expect(infra).toBeDefined();
		expect(infra?.label).toBe("基础设施");
		expect(infra?.children?.map(c => c.key)).toEqual([
			"/llm-factory/infra/scheduler",
			"/llm-factory/infra/gpu-monitor",
		]);
	});
});
