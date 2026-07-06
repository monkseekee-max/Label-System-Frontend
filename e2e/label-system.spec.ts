import { expect, test } from "@playwright/test";

/**
 * 智能标注 (Label System) E2E 测试
 *
 * 核心回归: 登录后台后, 智能标注各子页面均可正常打开 (不空白/不报错).
 * 使用真实菜单点击流程模拟用户实际操作.
 *
 * 鉴权: 通过 localStorage 注入开发期 API Key token (单租户模式 SUPER_ADMIN).
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

test.describe("智能标注后台", () => {
	test.beforeEach(async ({ page }) => {
		await loginViaStorage(page);
	});

	test("登录后进入首页, 侧边栏含智能标注菜单", async ({ page }) => {
		await page.goto("/home", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(3000);
		// 侧边栏应渲染智能标注父菜单
		await expect(page.locator(".ant-menu").filter({ hasText: "智能标注" })).toBeVisible({ timeout: 10000 });
	});

	test("各智能标注子页面均渲染实质内容 (菜单点击流程)", async ({ page }) => {
		test.setTimeout(120000);
		// 先进 dashboard, 等待侧边栏 + 路由就绪
		await page.goto("/label-system/dashboard", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(4000);

		const cases: Array<[string, RegExp]> = [
			["数据管理", /数据管理|资产|数据集/],
			["文本标注", /标注|工作台|任务|文本|资产/],
			["图片标注", /图片|标注|图像/],
			["视频标注", /视频|标注|帧/],
			["智能引擎", /智能|引擎|主动学习|进化/],
			["训练管线", /训练|管线|数据集/],
			["模型中心", /模型|中心|Hub/i],
			["数据飞轮", /飞轮|数据|统计/],
		];

		for (const [label, expectRe] of cases) {
			const errsBefore = 0;
			const link = page.locator(`.ant-menu a:has-text("${label}"), .ant-menu-item:has-text("${label}")`).first();
			await link.click({ timeout: 5000 });
			await page.waitForTimeout(3500);
			const url = page.url();
			const body = await page.locator("body").innerText().catch(() => "");
			// 不应跳到异常页
			expect(url, `${label} 不应跳转到异常页`).not.toMatch(/\/(exception|403|404|500)/);
			// 页面应有实质内容 (非空白)
			expect(body.replace(/\s/g, "").length, `${label} 页面不应空白`).toBeGreaterThan(40);
			// 应包含期望关键词
			expect(expectRe.test(body), `${label} 应包含期望内容`).toBeTruthy();
		}
	});

	test("智能标注父菜单展开且含子项", async ({ page }) => {
		// 进入一个子页面后, 父菜单应自动展开
		await page.goto("/label-system/dashboard", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(4000);
		const parent = page.locator(".ant-menu-submenu-title", { hasText: "智能标注" }).first();
		await expect(parent).toBeVisible({ timeout: 5000 });
		// 父菜单已展开 → 子项可见 (菜单可能有多个实例, 取 first)
		await expect(page.locator(".ant-menu").filter({ hasText: "训练管线" }).first()).toBeVisible();
		await expect(page.locator(".ant-menu").filter({ hasText: "智能引擎" }).first()).toBeVisible();
	});

	test("页面切换无 JS 错误 (intelligence → training-pipeline)", async ({ page }) => {
		test.setTimeout(60000);
		const errors: string[] = [];
		page.on("pageerror", e => errors.push(e.message));
		page.on("console", (msg) => {
			if (msg.type() === "error" && !msg.text().includes("antd")) {
				errors.push(msg.text());
			}
		});

		await page.goto("/label-system/intelligence", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(3000);
		// 通过菜单点击切换到训练管线 (真实用户流程)
		const link = page.locator(".ant-menu a:has-text(\"训练管线\"), .ant-menu-item:has-text(\"训练管线\")").first();
		await link.click({ timeout: 5000 });
		await page.waitForTimeout(3000);
		await expect(page).toHaveURL(/training-pipeline/);
		await expect(page.getByText(/训练管线/).first()).toBeVisible();
		// 不应有致命 JS 错误
		expect(errors.filter(e => /error|undefined|is not a function/i.test(e))).toEqual([]);
	});
});
