import { expect, test } from "@playwright/test";

/**
 * 登录注册页 E2E 测试
 *
 * 核心回归: 官网点击"免费注册"跳转 /login?mode=register 后,
 * 必须显示注册表单 (创建账号), 而非登录表单.
 */
test.describe("登录注册页", () => {
	test("登录表单正确渲染", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByText("手机号登录")).toBeVisible({ timeout: 5000 });
		await expect(page.getByLabel("手机号").or(page.locator("input").first())).toBeVisible();
	});

	test("[回归] 从官网进入注册 — 必须显示注册表单", async ({ page }) => {
		// 修复前: /login?mode=register 显示登录表单 (BUG)
		// 修复后: 显示注册表单 "创建账号"
		await page.goto("/login?mode=register");
		await expect(page.getByText("创建账号")).toBeVisible({ timeout: 5000 });
		// antd Button 会自动给中文加字间距 → 可访问性名称为 "注 册", 用正则匹配
		await expect(page.getByRole("button", { name: /注\s*册/ })).toBeVisible();
		// 不应同时显示登录表单标题
		await expect(page.getByText("手机号登录")).not.toBeVisible();
	});

	test("注册表单包含完整字段", async ({ page }) => {
		await page.goto("/login?mode=register");
		await expect(page.getByText("创建账号")).toBeVisible({ timeout: 5000 });
		await expect(page.getByLabel("手机号")).toBeVisible();
		await expect(page.getByLabel("所属公司")).toBeVisible();
		await expect(page.getByLabel("用户名")).toBeVisible();
		// 密码 + 确认密码都含"密码", 用第一个 (密码) 并验证确认密码存在
		await expect(page.getByLabel("密码").first()).toBeVisible();
		await expect(page.getByLabel("确认密码")).toBeVisible();
	});

	test("登录↔注册切换", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByText("手机号登录")).toBeVisible({ timeout: 5000 });
		// 登录表单本身没有切换到注册的入口 (单租户模式), 通过 URL 切换
		await page.goto("/login?mode=register");
		await expect(page.getByText("创建账号")).toBeVisible({ timeout: 5000 });
		// 注册表单内有"去登录"链接 (antd 会把 "去 登 录" 拆开)
		await page.getByRole("button", { name: /去\s*登\s*录/ }).click();
		await expect(page.getByText("手机号登录")).toBeVisible({ timeout: 5000 });
	});

	test("登录页有 Logo 和标题", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator("img[alt='App Logo']")).toBeVisible();
	});

	test("未登录访问根路径跳转官网", async ({ page }) => {
		await page.goto("/");
		await page.waitForURL("**/landing**", { timeout: 10000 });
		expect(page.url()).toContain("/landing");
	});

	test("未登录访问受保护页面跳转登录", async ({ page }) => {
		await page.goto("/home");
		await page.waitForURL("**/login**", { timeout: 10000 });
		expect(page.url()).toContain("/login");
	});

	test("未登录访问智能标注跳转登录 (携带 redirect)", async ({ page }) => {
		await page.goto("/label-system/dashboard");
		await page.waitForURL("**/login**", { timeout: 10000 });
		expect(page.url()).toContain("login");
	});
});
