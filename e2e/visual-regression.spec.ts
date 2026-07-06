import { expect, test } from "@playwright/test";

/**
 * Visual Regression 测试 (ADR-022 §10.4 item 5)
 *
 * 对关键公开页面捕获 screenshot baseline, 后续变更产生像素 diff 即报警.
 *
 * 首次运行: 生成 baseline (会 FAIL, 提示 "running with --update-snapshots")
 * 更新 baseline: npx playwright test visual-regression --update-snapshots
 * 日常运行: 比对 baseline, 像素差 > 1% 即 FAIL
 *
 * 仅覆盖无需登录的公开页面 (landing / login), 受保护页面需 auth fixture.
 */
test.describe("Visual Regression - 公开页面", () => {
	test("landing page 整页快照", async ({ page }) => {
		await page.goto("/landing");
		await page.waitForLoadState("networkidle");
		await expect(page).toHaveScreenshot("landing-full.png");
	});

	test("landing nav 区块快照", async ({ page }) => {
		await page.goto("/landing");
		await page.waitForLoadState("networkidle");
		await expect(page.locator("nav").first()).toHaveScreenshot("landing-nav.png");
	});

	test("landing hero 区块快照", async ({ page }) => {
		await page.goto("/landing");
		await page.waitForLoadState("networkidle");
		const hero = page.locator("section").filter({ hasText: "从数据到模型" }).first();
		await expect(hero).toHaveScreenshot("landing-hero.png");
	});

	test("login page 整页快照", async ({ page }) => {
		await page.goto("/login");
		await page.waitForLoadState("networkidle");
		await expect(page).toHaveScreenshot("login-full.png");
	});

	test("login 注册模式快照", async ({ page }) => {
		await page.goto("/login?mode=register");
		await page.waitForLoadState("networkidle");
		await expect(page).toHaveScreenshot("login-register-mode.png");
	});
});
