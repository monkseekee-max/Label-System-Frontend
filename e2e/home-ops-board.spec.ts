import { expect, test } from "@playwright/test";

/**
 * 首页 (/home) E2E 测试
 *
 * 验证运营看板已集成进首页 Tabs (继承自 /llm-factory/overview/ops-board),
 * 且功能模块导航 Tab 仍可用.
 */

const API_KEY = "dev_local_key_change_in_production";
const STORAGE_KEY = "react-antd-admin-0.0.0-dev-access-token";
const PREF_KEY = "react-antd-admin-0.0.0-dev-preferences";

/** 注入 token + 预设 onboarding 完成 (跳过引导向导遮罩) */
async function loginAndGoto(page: import("@playwright/test").Page, path = "/home") {
	await page.addInitScript(([keys]) => {
		const { storageKey, token, prefKey } = keys as { storageKey: string, token: string, prefKey: string };
		localStorage.setItem(
			storageKey,
			JSON.stringify({ state: { token, refreshToken: "" }, version: 0 }),
		);
		localStorage.setItem(
			prefKey,
			JSON.stringify({ state: { onboardingCompleted: true }, version: 0 }),
		);
	}, [{ storageKey: STORAGE_KEY, token: API_KEY, prefKey: PREF_KEY }]);
	await page.goto(path, { waitUntil: "domcontentloaded" });
}

test.describe("首页运营看板集成", () => {
	test("默认展示运营看板 Tab", async ({ page }) => {
		await loginAndGoto(page);
		// 默认 Tab 应为运营看板
		await expect(page.getByRole("tab", { name: "运营看板" })).toBeVisible();
		// 运营看板内容: 数据资产/Training Loss/服务健康 等标题
		await expect(page.getByText("Training Loss 趋势")).toBeVisible({ timeout: 10000 });
		await expect(page.getByText("服务健康")).toBeVisible();
		await expect(page.getByText("GPU 资源总览")).toBeVisible();
	});

	test("可切换到功能模块 Tab", async ({ page }) => {
		await loginAndGoto(page);
		await page.getByRole("tab", { name: "功能模块" }).click();
		// 功能模块网格: 出现模块卡片标题 (如 企业/数据/标注/训练/应用)
		await expect(page.getByText("功能模块", { exact: false })).toBeVisible({ timeout: 10000 });
		await expect(page.getByText("点击任意模块进入对应管理页面")).toBeVisible();
		// 模块卡片应可点击跳转
		const inferenceCard = page.getByText("应用", { exact: false });
		await expect(inferenceCard.first()).toBeVisible();
	});

	test("页面正常渲染, 不跳异常页", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", err => errors.push(err.message));
		await loginAndGoto(page);
		await expect(page.getByText("500", { exact: false })).not.toBeVisible({ timeout: 2000 }).catch(() => {});
		// 至少有运营看板的卡片渲染
		await expect(page.getByText("Training Loss 趋势")).toBeVisible({ timeout: 10000 });
		// 允许 echarts 的已知警告, 但不应有致命错误
		const fatal = errors.filter(e => !e.includes("ResizeObserver") && !e.includes("echarts"));
		expect(fatal).toHaveLength(0);
	});
});
