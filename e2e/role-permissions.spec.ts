import { expect, test } from "@playwright/test";

/**
 * 角色权限运行时验证 (2026-06-28 修复后).
 * 注入不同 position 的 mock 用户, 验证侧边栏菜单数量符合权限矩阵预期.
 * 重点: annotator/reviewer 修复后能看到「标注」分类 (修复前为 0).
 */

const STORAGE_KEY = "react-antd-admin-0.0.0-dev-access-token";
const PREF_KEY = "react-antd-admin-0.0.0-dev-preferences";

/** 注入指定 position 的 mock 用户 (mock /auth/me 返回对应 position) */
async function loginAs(page: import("@playwright/test").Page, position: string) {
	await page.addInitScript(([keys, pos]) => {
		const { storageKey, token, prefKey } = keys as { storageKey: string, token: string, prefKey: string };
		localStorage.setItem(storageKey, JSON.stringify({ state: { token, refreshToken: "" }, version: 0 }));
		localStorage.setItem(prefKey, JSON.stringify({ state: { onboardingCompleted: true }, version: 0 }));
		// 标记本次登录的角色 (供 route handler 读取)
		(sessionStorage as any).__mockPosition = pos;
	}, [{ storageKey: STORAGE_KEY, token: "mock-token", prefKey: PREF_KEY }, position]);
}

/** mock /api/auth/me 返回指定 position 的用户 (字段与真实 /auth/me 结构对齐) */
async function mockAuthMe(page: import("@playwright/test").Page, position: string) {
	await page.route("**/api/auth/me", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				code: 200,
				message: "success",
				data: {
					userId: 999,
					phone: "13900000099",
					username: `mock_${position.toLowerCase()}`,
					realName: `测试${position}`,
					role: "MANAGER",
					position,
					companyId: 1,
					companyCode: "HMJC",
					companyName: "华明检测",
					mustChangePassword: false,
				},
			}),
		});
	});
}

const CASES: Array<{ position: string, label: string, expectSees: string[], expectNotSees: string[] }> = [
	{
		position: "ANNOTATOR",
		label: "标注员",
		expectSees: ["标注"],
		expectNotSees: ["数据", "训练", "应用", "企业"],
	},
	{
		position: "REVIEWER",
		label: "审核员",
		expectSees: ["标注"],
		expectNotSees: ["数据", "训练", "应用", "企业"],
	},
	{
		position: "DATA_TRAINER",
		label: "训练师",
		expectSees: ["数据", "标注", "训练", "应用"],
		expectNotSees: [],
	},
];

for (const c of CASES) {
	test(`角色 ${c.label}(${c.position}) 侧边栏符合权限矩阵`, async ({ page }) => {
		await mockAuthMe(page, c.position);
		await loginAs(page, c.position);
		await page.goto("/home", { waitUntil: "domcontentloaded" });

		// 等待侧边栏菜单渲染
		await page.waitForTimeout(1500);

		// 应看到的分类
		for (const menu of c.expectSees) {
			await expect(page.locator(".ant-menu-submenu-title, .ant-menu-item").filter({ hasText: new RegExp(`^${menu}$`) }).first(), `${c.label} 应看到「${menu}」`).toBeVisible({ timeout: 10000 });
		}
		// 不应看到的分类
		for (const menu of c.expectNotSees) {
			const count = await page.locator(".ant-menu-submenu-title, .ant-menu-item").filter({ hasText: new RegExp(`^${menu}$`) }).count();
			expect(count, `${c.label} 不应看到「${menu}」`).toBe(0);
		}
	});
}

test("标注员能看到「标注」分类 (修复前为 0, 修复后可见)", async ({ page }) => {
	await mockAuthMe(page, "ANNOTATOR");
	await loginAs(page, "ANNOTATOR");
	await page.goto("/home", { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(2000);
	// 核心回归点: 修复前 annotator 侧边栏业务菜单 = 0, 修复后能看到「标注」分类
	await expect(page.locator(".ant-menu-submenu-title").filter({ hasText: /^标注$/ }).first()).toBeVisible({ timeout: 10000 });
});
