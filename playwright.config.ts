import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 测试配置
 *
 * 测试策略:
 * - webServer: 自动启动 vite dev (port 3333)
 * - baseURL: http://localhost:3333
 * - chromium 优先 (CI), 本地可加 firefox/webkit
 *
 * 运行: npx playwright test
 * UI 模式: npx playwright test --ui
 * 报告: npx playwright show-report
 */
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: process.env.CI ? "github" : "html",
	timeout: 30_000,
	expect: {
		timeout: 10_000,
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.01,
			threshold: 0.2,
			animations: "disabled",
			caret: "hide",
		},
	},
	use: {
		baseURL: "http://localhost:3335",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		locale: "zh-CN",
		viewport: { width: 1440, height: 900 },
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "pnpm dev",
		url: "http://localhost:3335",
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
