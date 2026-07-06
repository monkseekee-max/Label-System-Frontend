import enterpriseRoutes from "#src/router/routes/modules/enterprise";

/**
 * enterprise.ts 路由模块结构锁 (回归保护).
 * 锁住「基础设施已合并进运维与安全」这一事实, 防止误回退。
 */
import { describe, expect, it } from "vitest";

// 递归收集 {title, path} 扁平列表 (带 depth)
function collectTitles(route: typeof enterpriseRoutes[number], depth = 0): Array<{ title: string, path?: string, depth: number }> {
	const acc: Array<{ title: string, path?: string, depth: number }> = [];
	// handle.title 类型为 ReactNode (可含图标元素), 此处全部为纯字符串字面量, 用 String() 收窄
	const title = route.handle?.title ? String(route.handle.title) : undefined;
	if (title)
		acc.push({ title, path: route.path, depth });
	for (const child of route.children ?? [])
		acc.push(...collectTitles(child as typeof route, depth + 1));
	return acc;
}

describe("enterprise 路由模块: 基础设施已合并进运维与安全", () => {
	const enterprise = enterpriseRoutes[0]!;
	const flat = collectTitles(enterprise);
	const titles = flat.map(f => f.title);

	it("「基础设施」不再作为独立子分组存在", () => {
		expect(titles).not.toContain("基础设施");
	});

	it("「运维与安全」分组存在, 且包含全部 5 个子项 (调度器/GPU监控/审计日志/机器Token/SLO)", () => {
		const opsIdx = flat.findIndex(f => f.title === "运维与安全");
		expect(opsIdx).toBeGreaterThan(-1);
		const opsDepth = flat[opsIdx]!.depth;
		// 运维与安全的直接子项 (depth = opsDepth + 1, 紧随其后直到回到同层/更浅)
		const children: string[] = [];
		for (let i = opsIdx + 1; i < flat.length && flat[i]!.depth > opsDepth; i++) {
			if (flat[i]!.depth === opsDepth + 1)
				children.push(flat[i]!.title);
		}
		expect(children).toEqual([
			"调度器",
			"GPU 监控",
			"审计日志",
			"机器 Token",
			"SLO 可观测性",
		]);
	});

	it("「运维与安全」父级 roles 包含 dataTrainer (否则训练师看不到原基础设施的调度器/GPU监控)", () => {
		const opsRoute = (enterprise.children ?? []).find(
			c => c.handle?.title === "运维与安全",
		);
		expect(opsRoute?.handle?.roles).toContain("DATA_TRAINER");
	});
});
