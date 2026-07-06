import { expect, test } from "@playwright/test";

/**
 * 统一初始密码功能 e2e.
 *
 * 人员管理已整合进「企业管理」页面 (/platform/companies) 的 Tab, 访问后才渲染.
 *
 * 验证:
 * 1. 人员管理 Tab: 超管可见「统一初始密码」入口 + 已启用标签.
 * 2. 新增用户表单: 统一密码启用时 → 密码框灰显(disabled) + 预填统一密码.
 * 3. 统一密码未启用时 → 密码框可编辑且为空.
 */

const STORAGE_KEY = "react-antd-admin-0.0.0-dev-access-token";
const PREF_KEY = "react-antd-admin-0.0.0-dev-preferences";

async function loginAsSuperAdmin(page: import("@playwright/test").Page) {
	await page.addInitScript(([keys]) => {
		const { storageKey, token, prefKey } = keys as { storageKey: string, token: string, prefKey: string };
		localStorage.setItem(storageKey, JSON.stringify({ state: { token, refreshToken: "" }, version: 0 }));
		localStorage.setItem(prefKey, JSON.stringify({ state: { onboardingCompleted: true }, version: 0 }));
	}, [{ storageKey: STORAGE_KEY, token: "mock-token", prefKey: PREF_KEY }]);
}

async function mockSuperAdmin(page: import("@playwright/test").Page, defaultPwdEnabled = true) {
	await page.route("**/api/auth/me", (route) => {
		return route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				code: 200,
				message: "success",
				data: { userId: 999, phone: "13800000000", username: "admin", realName: "超管", role: "MANAGER", position: "SUPER_ADMIN", companyId: 1, companyCode: "HMJC", companyName: "华明", mustChangePassword: false },
			}),
		});
	});
	await page.route("**/api/iam/default-password", (route) => {
		return route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ code: 200, message: "success", data: { enabled: defaultPwdEnabled, password: "Demo@2026" } }),
		});
	});
	await page.route("**/api/company/users**", (route) => {
		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 200, message: "success", data: { records: [], total: 0 } }) });
	});
	await page.route("**/api/platform/companies**", (route) => {
		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 200, message: "success", data: [] }) });
	});
}

/** 进入企业管理页并切到「人员管理」Tab (访问后才渲染内容). */
async function openUserTab(page: import("@playwright/test").Page) {
	await page.goto("/platform/companies", { waitUntil: "domcontentloaded" });
	// 等企业管理页内部 Tabs 渲染 (懒加载较慢, 用 waitFor 而非固定超时)
	await expect(page.locator(".ant-tabs-tab").filter({ hasText: "人员管理" })).toBeVisible({ timeout: 20000 });
	await page.locator(".ant-tabs-tab").filter({ hasText: "人员管理" }).click();
	// 等 UserTab 懒加载 + 表格渲染 (统一初始密码按钮在工具栏)
	await expect(page.getByRole("button", { name: "新增", exact: true })).toBeVisible({ timeout: 15000 });
}

test("人员管理 Tab: 超管可见「统一初始密码」入口 + 已启用标签", async ({ page }) => {
	await mockSuperAdmin(page, true);
	await loginAsSuperAdmin(page);
	await openUserTab(page);
	await expect(page.getByRole("button", { name: "统一初始密码" })).toBeVisible({ timeout: 10000 });
	await expect(page.locator(".ant-tag").filter({ hasText: "已启用统一初始密码" })).toBeVisible({ timeout: 5000 });
});

test("新增用户: 统一密码启用时密码框灰显 + 预填 Demo@2026", async ({ page }) => {
	await mockSuperAdmin(page, true);
	await loginAsSuperAdmin(page);
	await openUserTab(page);
	await page.getByRole("button", { name: "新增", exact: true }).click();
	await page.waitForTimeout(800);
	const pwdInput = page.locator("input#password").first();
	await expect(pwdInput).toBeVisible({ timeout: 5000 });
	await expect(pwdInput).toBeDisabled();
	await expect(pwdInput).toHaveValue("Demo@2026");
});

test("新增用户: 统一密码未启用时密码框可编辑且为空", async ({ page }) => {
	await mockSuperAdmin(page, false);
	await loginAsSuperAdmin(page);
	await openUserTab(page);
	await expect(page.locator(".ant-tag").filter({ hasText: "已启用统一初始密码" })).toHaveCount(0);
	await page.getByRole("button", { name: "新增", exact: true }).click();
	await page.waitForTimeout(800);
	const pwdInput = page.locator("input#password").first();
	await expect(pwdInput).toBeVisible({ timeout: 5000 });
	await expect(pwdInput).toBeEnabled();
	await expect(pwdInput).toHaveValue("");
});
