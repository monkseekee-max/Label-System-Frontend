import { expect, test } from "@playwright/test";

/**
 * 完整用户旅程 E2E 测试
 *
 * 模拟真实用户从官网到功能页的完整流程:
 * 官网首页 → 点击注册 → 看到注册表单 → 切换登录 → 进入后台 → 智能标注
 */
const API_KEY = "dev_local_key_change_in_production";
const STORAGE_KEY = "react-antd-admin-0.0.0-dev-access-token";

test.describe("完整用户旅程", () => {
	test("[核心] 官网 → 注册表单 (修复回归)", async ({ page }) => {
		// 1. 访问官网
		await page.goto("/landing");
		await expect(page.getByRole("heading", { level: 1 })).toContainText("从数据到模型");

		// 2. 点击 CTA 进入注册
		await page.getByRole("button", { name: /立即体验/ }).click();
		await page.waitForURL("**/login**");
		expect(page.url()).toContain("mode=register");

		// 3. 必须渲染注册表单 (修复前显示登录表单)
		await expect(page.getByText("创建账号")).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole("button", { name: /注\s*册/ })).toBeVisible();
	});

	test("官网导航栏交互", async ({ page }) => {
		await page.goto("/landing");

		// 点击导航栏登录按钮
		await page.getByRole("button", { name: "登录", exact: true }).click();
		await page.waitForURL("**/login**");
		expect(page.url()).not.toContain("mode=register");

		// 回到官网
		await page.goBack();
		await expect(page.getByText("LLM Factory").first()).toBeVisible();
	});

	test("官网页面滚动流畅", async ({ page }) => {
		await page.goto("/landing");

		// 滚动到底部
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await page.waitForTimeout(500);

		// 页脚可见
		await expect(page.locator("footer")).toBeVisible();

		// 滚回顶部
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(500);

		// 导航栏可见
		await expect(page.locator("nav")).toBeVisible();
	});

	test("官网所有区块渲染完整", async ({ page }) => {
		await page.goto("/landing");

		// Hero 区
		await expect(page.getByText("端到端 · 大模型训练工厂")).toBeVisible();

		// 飞轮区
		await expect(page.getByText("回流", { exact: true }).first()).toBeVisible();

		// 能力区
		await expect(page.getByText("质量门禁").first()).toBeVisible();
		await expect(page.getByText("模型生命周期")).toBeVisible();
		await expect(page.getByText("三平面架构")).toBeVisible();

		// 工作流区
		await expect(page.getByRole("heading", { name: "四步打造你的领域大模型" })).toBeVisible();

		// 架构区
		await expect(page.getByText("工程级架构").first()).toBeVisible();
		await expect(page.getByText("ADR 架构决策")).toBeVisible();

		// CTA 区
		await expect(page.getByText("开启你的大模型训练之旅")).toBeVisible();
	});

	test("官网响应式 - 移动端", async ({ page }) => {
		// 设置移动端视口
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/landing");

		// 关键内容在移动端仍可见
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		await expect(page.getByRole("button", { name: /立即体验/ })).toBeVisible();
		await expect(page.locator("nav")).toBeVisible();
	});

	test("官网响应式 - 平板", async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto("/landing");

		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		await expect(page.getByText("六大核心能力")).toBeVisible();
	});

	test("[登录态] 已登录用户官网 CTA 变为进入控制台", async ({ page }) => {
		// 注入 token 模拟已登录
		await page.addInitScript(([key, token]) => {
			localStorage.setItem(
				key,
				JSON.stringify({ state: { token, refreshToken: "" }, version: 0 }),
			);
		}, [STORAGE_KEY, API_KEY]);

		await page.goto("/landing");
		await page.waitForTimeout(2000);
		// 已登录: 导航栏主 CTA 应为"进入控制台"
		await expect(page.getByRole("button", { name: /进入控制台/ }).first()).toBeVisible({ timeout: 5000 });
		// 不应再显示"免费开始"
		await expect(page.getByRole("button", { name: /免费开始/ })).toHaveCount(0);
	});
});
