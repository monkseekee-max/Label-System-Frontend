import { expect, test } from "@playwright/test";

/**
 * 登录后功能页面 E2E 测试 (模型训练工厂)
 *
 * 使用真实开发期 API Key 注入 token, 验证 llm-factory 各功能页可正常渲染.
 */

const API_KEY = "dev_local_key_change_in_production";
const STORAGE_KEY = "react-antd-admin-0.0.0-dev-access-token";

async function loginViaStorage(page: import("@playwright/test").Page) {
	await page.addInitScript(([key, token]) => {
		localStorage.setItem(
			key,
			JSON.stringify({ state: { token, refreshToken: "" }, version: 0 }),
		);
	}, [STORAGE_KEY, API_KEY]);
}

test.describe("模型训练工厂功能页", () => {
	test.beforeEach(async ({ page }) => {
		await loginViaStorage(page);
	});

	test("仪表盘页面加载并渲染内容", async ({ page }) => {
		await page.goto("/llm-factory/overview/dashboard", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(3000);
		// 不应跳到异常页
		expect(page.url()).not.toMatch(/\/(exception|403|404|500)/);
		const body = await page.locator("body").innerText();
		expect(body.replace(/\s/g, "").length).toBeGreaterThan(40);
	});

	test("数据管道页面可访问", async ({ page }) => {
		await page.goto("/llm-factory/data/pipeline", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(3000);
		expect(page.url()).not.toMatch(/\/(exception|403|404|500)/);
		const body = await page.locator("body").innerText();
		expect(body.replace(/\s/g, "").length).toBeGreaterThan(40);
	});

	test("模型训练页面可访问", async ({ page }) => {
		await page.goto("/llm-factory/model/training", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(3000);
		expect(page.url()).not.toMatch(/\/(exception|403|404|500)/);
		const body = await page.locator("body").innerText();
		expect(body.replace(/\s/g, "").length).toBeGreaterThan(40);
	});

	test("GPU 监控页面可访问", async ({ page }) => {
		await page.goto("/llm-factory/infra/gpu-monitor", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(3000);
		expect(page.url()).not.toMatch(/\/(exception|403|404|500)/);
		const body = await page.locator("body").innerText();
		expect(body.replace(/\s/g, "").length).toBeGreaterThan(40);
	});
});
