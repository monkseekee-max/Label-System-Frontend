import { expect, test } from "@playwright/test";

/**
 * 官网首页 (Landing Page) E2E 测试
 *
 * 验证生产级公共首页 (增强版):
 * - 导航栏渲染 + 锚点导航
 * - Hero 区 (主标题 + CTA + 终端演示)
 * - 统计数据
 * - 数据飞轮可视化
 * - 核心能力卡片
 * - 工作流 / 架构 / FAQ 区块
 * - 未登录态 CTA (免费开始 / 立即体验 / 免费注册)
 * - 跳转登录/注册
 */
test.describe("官网首页 (Landing Page)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/landing");
	});

	test("导航栏正确渲染 + 锚点链接", async ({ page }) => {
		await expect(page.locator("nav")).toBeVisible();
		await expect(page.getByText("LLM Factory").first()).toBeVisible();
		await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: /免费开始/ })).toBeVisible();
		// 锚点导航链接
		await expect(page.getByRole("button", { name: "核心能力", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "工作流", exact: true })).toBeVisible();
	});

	test("Hero 区主标题 + 终端演示显示", async ({ page }) => {
		await expect(page.getByRole("heading", { level: 1 })).toContainText("从数据到模型");
		await expect(page.getByText("一站式闭环")).toBeVisible();
		await expect(page.getByText(/llamafactory-cli train/).first()).toBeVisible();
	});

	test("Hero CTA 按钮存在", async ({ page }) => {
		await expect(page.getByRole("button", { name: /立即体验/ })).toBeVisible();
		await expect(page.getByRole("button", { name: /查看工作流/ })).toBeVisible();
	});

	test("统计数据渲染", async ({ page }) => {
		// 使用 first() 避免与 FAQ 正文中的同名词冲突
		await expect(page.getByText("标注记录", { exact: true })).toBeVisible();
		await expect(page.getByText("训练步数", { exact: true })).toBeVisible();
		await expect(page.getByText("峰值显存", { exact: true }).first()).toBeVisible();
	});

	test("数据飞轮步骤显示", async ({ page }) => {
		await expect(page.getByRole("heading", { name: "数据飞轮 · 越转越快" })).toBeVisible();
		await expect(page.getByText("标注", { exact: true }).first()).toBeVisible();
		await expect(page.getByText("数据集", { exact: true }).first()).toBeVisible();
		await expect(page.getByText("评测", { exact: true }).first()).toBeVisible();
		await expect(page.getByText("回流", { exact: true }).first()).toBeVisible();
	});

	test("核心能力卡片渲染", async ({ page }) => {
		await expect(page.getByRole("heading", { name: "六大核心能力" })).toBeVisible();
		await expect(page.getByText("数据飞轮闭环").first()).toBeVisible();
		await expect(page.getByText("LoRA 高效微调")).toBeVisible();
		await expect(page.getByText("vLLM 极速推理")).toBeVisible();
		await expect(page.getByText("质量门禁").first()).toBeVisible();
		await expect(page.getByText("模型生命周期")).toBeVisible();
		await expect(page.getByText("三平面架构")).toBeVisible();
	});

	test("工作流区块渲染", async ({ page }) => {
		await expect(page.getByRole("heading", { name: "四步打造你的领域大模型" })).toBeVisible();
		await expect(page.getByText(/01 · 数据导入/)).toBeVisible();
		await expect(page.getByText(/04 · 部署评测/)).toBeVisible();
	});

	test("技术架构分层渲染", async ({ page }) => {
		await expect(page.getByText("工程级架构").first()).toBeVisible();
		await expect(page.getByText("应用平面")).toBeVisible();
		await expect(page.getByText("计算平面")).toBeVisible();
		await expect(page.getByText("数据平面")).toBeVisible();
		await expect(page.getByText("ADR 架构决策")).toBeVisible();
	});

	test("FAQ 区块渲染", async ({ page }) => {
		await expect(page.getByRole("heading", { name: "常见问题" })).toBeVisible();
		await expect(page.getByText("需要什么硬件配置？")).toBeVisible();
	});

	test("点击'免费开始'跳转到注册 (带 mode 参数)", async ({ page }) => {
		await page.getByRole("button", { name: /免费开始/ }).first().click();
		await page.waitForURL("**/login**");
		expect(page.url()).toContain("mode=register");
		// 现在应显示注册表单而非登录表单
		await expect(page.getByText("创建账号")).toBeVisible({ timeout: 5000 });
	});

	test("点击'登录'跳转到登录页 (无 mode)", async ({ page }) => {
		await page.getByRole("button", { name: "登录" }).first().click();
		await page.waitForURL("**/login**");
		expect(page.url()).not.toContain("mode=register");
	});

	test("CTA 区行动召唤显示", async ({ page }) => {
		await expect(page.getByText("开启你的大模型训练之旅")).toBeVisible();
		await expect(page.getByRole("button", { name: /免费注册/ })).toBeVisible();
	});

	test("页脚多列信息显示", async ({ page }) => {
		await expect(page.locator("footer")).toBeVisible();
		await expect(page.getByText(/Built with React/)).toBeVisible();
		await expect(page.getByText("产品").first()).toBeVisible();
		await expect(page.getByText("资源").first()).toBeVisible();
	});
});
