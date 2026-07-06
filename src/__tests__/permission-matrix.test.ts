/**
 * 全站角色权限矩阵单测 (回归保护, 2026-06-28 审查后建立).
 *
 * 用真实的 generateRoutesByFrontend (filterTree + expandRoleHierarchy) 跑出每个角色
 * 实际可见的业务页面, 锁住两件事:
 * 1. 路由权限矩阵: 每个角色可见/不可见的核心页面符合职责预期.
 * 2. 首页卡片一致性: 每张卡片的 path 对其 positions 的所有角色都可达 (无 403 死链).
 *
 * 防止: filterTree 父级角色并集缺失 → 整棵子树被丢弃 (如 annotator/reviewer 看不到标注).
 *
 * 注意: filterTree 会 mutate 入参树的 children (node.children = ...), 而 accessRoutes 是
 * 模块级单例. 故每次过滤前必须深拷贝树结构 (cloneRoutes), 否则测试间相互污染, 且
 * 运行时 auth-guard 多次调用也会基于残缺树过滤.
 */
import type { AppRouteRecordRaw } from "#src/router/types";
import { MODULE_LIST } from "#src/pages/home/index";
import { FrontendRoles, hasAnyRole } from "#src/router/role-hierarchy";
import { accessRoutes } from "#src/router/routes";
import { generateRoutesByFrontend } from "#src/router/utils/generate-routes-from-frontend";
import { describe, expect, it } from "vitest";

/** 深拷贝路由树结构 (保留 Component/lazy 引用, 只复制结构节点), 防止 filterTree mutate 单例. */
function cloneRoutes(routes: AppRouteRecordRaw[]): AppRouteRecordRaw[] {
	return routes.map(r => ({
		...r,
		handle: r.handle ? { ...r.handle } : undefined,
		children: r.children ? cloneRoutes(r.children as AppRouteRecordRaw[]) : undefined,
	})) as AppRouteRecordRaw[];
}

/** 收集过滤后路由树中所有「有 path 的叶子」的 title (含 hideInMenu 页面). */
function visibleLeavesFor(role: string): string[] {
	// 每次 clone, 保护 accessRoutes 单例不被 filterTree mutate 污染
	const filtered = generateRoutesByFrontend(cloneRoutes(accessRoutes), [role]);
	const titles: string[] = [];
	const walk = (routes: AppRouteRecordRaw[]) => {
		for (const r of routes) {
			if (r.path && r.handle?.title)
				titles.push(String(r.handle.title));
			if (r.children)
				walk(r.children as AppRouteRecordRaw[]);
		}
	};
	walk(filtered);
	return titles;
}

/** 在路由树中按 path 查找节点 (递归, 返回首个匹配). */
function findRouteByPath(routes: AppRouteRecordRaw[], path: string): AppRouteRecordRaw | undefined {
	for (const r of routes) {
		if (r.path === path)
			return r;
		if (r.children) {
			const found = findRouteByPath(r.children as AppRouteRecordRaw[], path);
			if (found)
				return found;
		}
	}
	return undefined;
}

// 后端 position → 前端 role (与 permission-mapping.ts 一致)
const positionToRole: Record<string, string> = {
	SUPER_ADMIN: FrontendRoles.superAdmin,
	ADMIN: FrontendRoles.admin,
	ANNOTATOR: FrontendRoles.annotator,
	DATA_TRAINER: FrontendRoles.dataTrainer,
	REVIEWER: FrontendRoles.reviewer,
};

const includesAll = (arr: string[], items: string[]) => items.every(i => arr.includes(i));
const includesNone = (arr: string[], items: string[]) => items.every(i => !arr.includes(i));

describe("角色权限矩阵: 标注员/审核员不再被边缘化", () => {
	it("标注员(ANNOTATOR) 能看到标注工作台 + 智能引擎 (核心生产工具)", () => {
		const v = visibleLeavesFor(FrontendRoles.annotator);
		expect(includesAll(v, ["标注工作台", "智能引擎"])).toBe(true);
	});

	it("标注员(ANNOTATOR) 看不到质量评估/对齐分析 (那是审核员职责)", () => {
		const v = visibleLeavesFor(FrontendRoles.annotator);
		expect(includesNone(v, ["质量评估", "对齐分析"])).toBe(true);
	});

	it("审核员(REVIEWER) 能看到标注工作台 + 质量评估 + 对齐分析", () => {
		const v = visibleLeavesFor(FrontendRoles.reviewer);
		expect(includesAll(v, ["标注工作台", "质量评估", "对齐分析"])).toBe(true);
	});

	it("审核员(REVIEWER) 看不到智能引擎 (那是标注员/训练师工具)", () => {
		const v = visibleLeavesFor(FrontendRoles.reviewer);
		expect(includesNone(v, ["智能引擎"])).toBe(true);
	});

	it("标注员/审核员 看不到数据/训练/应用/企业分类 (非其职责)", () => {
		const ann = visibleLeavesFor(FrontendRoles.annotator);
		const rev = visibleLeavesFor(FrontendRoles.reviewer);
		const forbidden = ["数据概览", "训练管线", "推理服务", "平台概览", "企业管理"];
		expect(includesNone(ann, forbidden)).toBe(true);
		expect(includesNone(rev, forbidden)).toBe(true);
	});
});

describe("角色权限矩阵: 超管/管理员/训练师", () => {
	it("超管(SUPER_ADMIN) 能看到全部业务页面 (含 super-only 的企业管理)", () => {
		const v = visibleLeavesFor(FrontendRoles.superAdmin);
		expect(includesAll(v, ["企业管理", "审计日志", "机器 Token", "标注工作台"])).toBe(true);
		// 至少覆盖 5 大分类的代表页
		expect(includesAll(v, ["平台概览", "数据概览", "标注工作台", "训练管线", "推理服务"])).toBe(true);
	});

	it("管理员(ADMIN) 看不到 super-only 的企业管理, 但能看运维审计", () => {
		const v = visibleLeavesFor(FrontendRoles.admin);
		expect(includesNone(v, ["企业管理"])).toBe(true);
		expect(includesAll(v, ["平台概览", "审计日志", "机器 Token", "SLO 可观测性"])).toBe(true);
	});

	it("训练师(DATA_TRAINER) 能看数据概览/训练管线/模型中心 (训练全链路), 看不到企业管理/审计日志", () => {
		const v = visibleLeavesFor(FrontendRoles.dataTrainer);
		expect(includesAll(v, ["数据概览", "标注数据", "训练管线", "模型中心", "推理服务", "智能问答", "调度器", "GPU 监控", "平台概览"])).toBe(true);
		expect(includesNone(v, ["企业管理", "审计日志", "机器 Token", "SLO 可观测性", "标注工作台"])).toBe(true);
	});
});

describe("首页卡片一致性: 卡片 path 对其 positions 所有角色可达 (无 403 死链)", () => {
	for (const card of MODULE_LIST) {
		it(`卡片「${String(card.title)}」(path=${card.path}) 对所有 positions 角色可达`, () => {
			const route = findRouteByPath(accessRoutes, card.path);
			// 卡片 path 必须存在于路由树
			expect(route, `卡片 path ${card.path} 未在路由树中找到`).toBeDefined();
			const routeRoles = route?.handle?.roles as string[] | undefined;
			// 该卡片声明的每个 position 角色, 都必须能访问该 path
			for (const position of card.positions) {
				const frontendRole = positionToRole[position];
				expect(frontendRole, `未知 position: ${position}`).toBeDefined();
				if (routeRoles && routeRoles.length) {
					const canAccess = hasAnyRole([frontendRole], routeRoles);
					expect(
						canAccess,
						`角色 ${frontendRole} (${position}) 在卡片「${String(card.title)}」中, 但无权访问 ${card.path} (route.roles=${JSON.stringify(routeRoles)}) → 死链`,
					).toBe(true);
				}
			}
		});
	}
});

describe("首页卡片: 每个角色看到的卡片与侧边栏菜单不脱节", () => {
	it("超管(SUPER_ADMIN) 能看到全部 6 张卡片 (与侧边栏全可见一致)", () => {
		const cards = MODULE_LIST.filter(c => c.positions.includes("SUPER_ADMIN"));
		expect(cards.length).toBe(6);
	});

	it("标注员(ANNOTATOR) 能看到「标注」卡片 (其侧边栏标注分类非空)", () => {
		const cards = MODULE_LIST.filter(c => c.positions.includes("ANNOTATOR"));
		const titles = cards.map(c => String(c.title));
		expect(titles).toContain("标注");
		// 标注卡片对应的侧边栏标注分类, 标注员确实有可见页
		const annVisible = visibleLeavesFor(FrontendRoles.annotator);
		expect(annVisible.length).toBeGreaterThan(0);
	});

	it("审核员(REVIEWER) 能看到「标注」卡片 (其侧边栏标注分类非空)", () => {
		const cards = MODULE_LIST.filter(c => c.positions.includes("REVIEWER"));
		expect(cards.map(c => String(c.title))).toContain("标注");
		const revVisible = visibleLeavesFor(FrontendRoles.reviewer);
		expect(revVisible.length).toBeGreaterThan(0);
	});
});
