/**
 * 无障碍 (a11y) 自动化门禁 — 基于 @axe-core/playwright。
 *
 * 激活步骤（需先装依赖）：
 *   pnpm add -D @axe-core/playwright
 *
 * 激活后取消下方 import 与断言注释，CI 即对每个受保护路由跑 axe 无障碍规则。
 * 当前以「ready-to-activate」骨架存放，避免引入未经评估的运行时依赖。
 *
 * 规则集：wcag2aa（WCAG 2.0 AA）+ 最佳实践子集。违规为 error，阻断 CI。
 */
import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = [
	{ name: "home", path: "/home" },
	{ name: "llm-factory-dashboard", path: "/llm-factory/overview/dashboard" },
	{ name: "label-dashboard", path: "/label-system/dashboard" },
];

test.describe("无障碍门禁 (axe)", () => {
	test.skip(true, "未激活：需先 pnpm add -D @axe-core/playwright，再取消本文件内注释");

	for (const route of PROTECTED_ROUTES) {
		test(`${route.name} 无 WCAG 2.0 AA 违规`, async ({ page }) => {
			// 需先通过登录鉴权；复用 e2e/ 既有 auth setup 或注入 token。
			await page.goto(route.path);

			// import AxeBuilder from "@axe-core/playwright";
			// const results = await new AxeBuilder({ page })
			// 	.withTags(["wcag2a", "wcag2aa"])
			// 	.analyze();
			// expect(results.violations).toEqual([]);

			expect(route.path).toBeDefined();
		});
	}
});
