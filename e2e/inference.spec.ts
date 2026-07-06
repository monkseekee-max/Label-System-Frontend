import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

/**
 * 推理服务页面 (/llm-factory/model/inference) E2E 测试
 *
 * 重构后验证点:
 * - 页面正常渲染, 不跳异常页
 * - 推理端口卡片展示 (文本 ONLINE / 多模态 OFFLINE)
 * - VRAM 分段从真实数据派生
 * - LoRA 适配器列表
 * - 推理试玩: 发送 → 回答 + token/延迟
 * - 回车发送 / Shift+Enter 换行 / 清空历史
 * - 推理失败错误展示
 *
 * 策略: mock 真实接口路径前缀 (auth + factory/lora + inference/chat), 确定性, 不依赖 vLLM.
 * 注意: factory-client request() 期望信封 {code,message,data} 并取 data; route 用 pathname
 * 匹配 (勿用 glob 模式, 否则误伤 src 下 api 模块加载导致 MIME 错误).
 */

const STORAGE_KEY = "react-antd-admin-0.0.0-dev-access-token";
const PREF_KEY = "react-antd-admin-0.0.0-dev-preferences";
const TOKEN = "fake-super-admin-token";

const AUTH_USER = {
	userId: "t1",
	username: "admin",
	realName: "测试超管",
	phone: "13800000000",
	role: "ENGINEER",
	position: "SUPER_ADMIN",
	companyId: 1,
	companyCode: "D",
	companyName: "Demo",
};

/** factory-client 期望 {code,message,data} 信封, data 为 lora 版本 */
const LORA_VERSIONS_ENVELOPE = {
	code: 200,
	message: "ok",
	data: {
		models: [
			{
				modelName: "qwen3-8b",
				modelPath: "/models/qwen3-8b",
				parameterSize: "8B",
				trainingTrack: "text",
				taskTypes: ["chat"],
				diskSize: "16GB",
				inferencePort: 8001,
				contextLength: 32768,
				loraVersions: [
					{ versionTag: "latest", loraPath: "/loras/latest", isActive: true, createdAt: "2026-06-01T00:00:00Z" },
					{ versionTag: "v1.2", loraPath: "/loras/v1.2", isActive: false, createdAt: "2026-05-20T00:00:00Z" },
				],
			},
		],
		operationLogs: [],
	},
};

const CHAT_RESPONSE = {
	content: "LoRA (Low-Rank Adaptation) 是一种参数高效微调方法, 通过冻结基座模型权重并仅训练注入的低秩矩阵, 大幅降低显存与训练成本。",
	reasoning: "用户问 LoRA 微调, 我需要简洁解释其原理与优势...",
	has_reasoning: true,
	model: "latest",
	usage: { prompt_tokens: 12, completion_tokens: 48, total_tokens: 60 },
};

/** 构造 SSE 流式响应体 (模拟后端 vllm_inference_stream 的 delta/done 事件) */
function sseBody(opts: { model?: string, deltas?: string[], usage?: typeof CHAT_RESPONSE.usage, error?: string } = {}): string {
	const model = opts.model ?? "latest";
	const deltas = opts.deltas ?? ["<think>", "思考中...", "</think>", CHAT_RESPONSE.content];
	const frames = deltas.map(d => `data: ${JSON.stringify({ type: "delta", content: d })}\n\n`);
	frames.push(`data: ${JSON.stringify({ type: "done", model, usage: opts.usage ?? CHAT_RESPONSE.usage })}\n\n`);
	return frames.join("");
}

/** 构造错误 SSE 流 (模拟推理失败) */
function sseErrorBody(msg: string): string {
	return `data: ${JSON.stringify({ type: "error", error: msg })}\n\n`;
}

/** 用 pathname.startsWith 精确匹配 /api/, 放行 /src/api/ 模块加载 */
async function routeApi(page: Page, handler: (url: string, path: string, route: import("@playwright/test").Route) => Promise<unknown>) {
	await page.route((url) => {
		try {
			return new URL(url.toString()).pathname.startsWith("/api/");
		}
		catch {
			return false;
		}
	}, async (route) => {
		const path = new URL(route.request().url()).pathname;
		await handler(route.request().url(), path, route);
	});
}

async function setupMocks(page: Page) {
	await routeApi(page, async (_url, path, route) => {
		if (path === "/api/auth/me") {
			return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 200, message: "ok", data: AUTH_USER }) });
		}
		if (path === "/api/auth/refresh") {
			return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 200, message: "ok", data: { token: TOKEN, access_token: TOKEN, refresh_token: "r" } }) });
		}
		if (path === "/api/get-async-routes") {
			return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
		}
		if (path === "/api/v1/factory/lora/versions") {
			return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(LORA_VERSIONS_ENVELOPE) });
		}
		// system/info 返回裸对象 (无 {code,message,data} 信封), 含 vllm 真实探活状态.
		// fetchInferencePorts 用 vllm.text/multimodal.running 决定端口 ONLINE/OFFLINE.
		if (path === "/api/v1/system/info") {
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					gpu: { device: "RTX 5090", vram_total_gb: 24, vram_used_gb: 21.5, available: true },
					vllm: {
						text: { running: true, port: 8001, pids: [12345], models: ["qwen3-8b", "latest"] },
						multimodal: { running: false, port: 8002, pids: [], models: [] },
					},
				}),
			});
		}
		if (path === "/api/v1/inference/chat") {
			return route.fulfill({ status: 200, contentType: "text/event-stream", body: sseBody() });
		}
		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 200, message: "ok", data: { items: [], total: 0 } }) });
	});
}

/** 点击「发送」按钮: 先滚入视区再点击 (按钮位于折叠下方, 需滚动到可见) */
async function clickSend(page: Page) {
	const btn = page.getByRole("button", { name: "发送" });
	await btn.scrollIntoViewIfNeeded();
	await btn.click();
}

async function loginAndGoto(page: Page) {
	await page.addInitScript(([tokenKey, prefKey, token]) => {
		// 1. 注入登录 token
		localStorage.setItem(tokenKey, JSON.stringify({ state: { token, refreshToken: "r" }, version: 0 }));
		// 2. 预置 onboardingCompleted, 跳过全屏引导弹窗 (否则其遮罩拦截所有点击)
		localStorage.setItem(prefKey, JSON.stringify({ state: { onboardingCompleted: true }, version: 0 }));
	}, [STORAGE_KEY, PREF_KEY, TOKEN]);
	await setupMocks(page);
	await page.goto("/llm-factory/model/inference", { waitUntil: "domcontentloaded" });
	// 等待端口卡片渲染 (文本端口标题出现)
	await expect(page.getByText("文本推理端口").first()).toBeVisible({ timeout: 15000 });
}

test.describe("推理服务页面", () => {
	test("页面正常渲染, 不跳异常页", async ({ page }) => {
		await loginAndGoto(page);
		expect(page.url()).not.toMatch(/\/(exception|403|404|500)/);
		await expect(page.getByRole("heading", { name: "推理服务" })).toBeVisible();
		await expect(page.getByText("双端口 vLLM 推理引擎")).toBeVisible();
	});

	test("展示双端口卡片 (文本 ONLINE / 多模态 OFFLINE)", async ({ page }) => {
		await loginAndGoto(page);
		await expect(page.getByText("文本推理端口").first()).toBeVisible();
		await expect(page.getByText("多模态推理端口").first()).toBeVisible();
		const textCard = page.locator(".ant-card").filter({ hasText: "文本推理端口" });
		await expect(textCard.getByText("运行中", { exact: true }).first()).toBeVisible();
		const mmCard = page.locator(".ant-card").filter({ hasText: "多模态推理端口" });
		await expect(mmCard.getByText("离线", { exact: true })).toBeVisible();
	});

	test("VRAM 占用显示真实数值", async ({ page }) => {
		await loginAndGoto(page);
		const textCard = page.locator(".ant-card").filter({ hasText: "文本推理端口" });
		// vramUsed 从 system/info.gpu.vram_used_gb 派生 (mock=21.5) / vramTotal=24 → "21.5 / 24 GB"
		await expect(textCard.getByText("VRAM 占用")).toBeVisible();
		await expect(textCard.getByText(/21\.5\s*\/\s*24/)).toBeVisible();
	});

	test("LoRA 适配器列表展示 active 状态", async ({ page }) => {
		await loginAndGoto(page);
		const textCard = page.locator(".ant-card").filter({ hasText: "文本推理端口" });
		await expect(textCard.getByText("LoRA 热插拔")).toBeVisible();
		// active LoRA "latest" 显示 req/h
		await expect(textCard.getByText("latest")).toBeVisible();
		await expect(textCard.getByText(/req\/h/)).toBeVisible();
	});

	test("推理试玩: 发送后收到回答 + token/延迟统计", async ({ page }) => {
		await loginAndGoto(page);
		const textarea = page.locator("textarea").first();
		await textarea.fill("什么是 LoRA 微调");
		await clickSend(page);
		// 回答出现在终端区域
		await expect(page.getByText("LoRA (Low-Rank Adaptation)", { exact: false })).toBeVisible({ timeout: 10000 });
		await expect(page.getByText(/tokens\s*12\+48/).first()).toBeVisible();
		await expect(page.getByText(/延迟\s*\d+ms/).first()).toBeVisible();
	});

	test("回车键发送消息", async ({ page }) => {
		await loginAndGoto(page);
		const textarea = page.locator("textarea").first();
		await textarea.fill("回车发送测试");
		await textarea.press("Enter");
		await expect(page.getByText("LoRA (Low-Rank Adaptation)", { exact: false })).toBeVisible({ timeout: 10000 });
	});

	test("Shift+Enter 换行不发送", async ({ page }) => {
		await loginAndGoto(page);
		const textarea = page.locator("textarea").first();
		await textarea.fill("第一行");
		await textarea.press("Shift+Enter");
		await textarea.type("第二行");
		await page.waitForTimeout(1500);
		await expect(page.getByText("LoRA (Low-Rank Adaptation)", { exact: false })).not.toBeVisible();
		const val = await textarea.inputValue();
		expect(val).toContain("第一行");
		expect(val).toContain("第二行");
	});

	test("清空历史功能", async ({ page }) => {
		await loginAndGoto(page);
		await page.locator("textarea").first().fill("测试清空");
		await clickSend(page);
		await expect(page.getByText("LoRA (Low-Rank Adaptation)", { exact: false })).toBeVisible({ timeout: 10000 });
		await page.getByRole("button", { name: "清空", exact: true }).click();
		await expect(page.getByText("LoRA (Low-Rank Adaptation)", { exact: false })).not.toBeVisible();
	});

	test("模型切换 Segmented", async ({ page }) => {
		await loginAndGoto(page);
		let requestBody: { model?: string } | null = null;
		await routeApi(page, async (_url, path, route) => {
			if (path === "/api/v1/inference/chat") {
				requestBody = route.request().postDataJSON() as { model?: string };
				return route.fulfill({ status: 200, contentType: "text/event-stream", body: sseBody({ model: "qwen3-8b" }) });
			}
			return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 200, message: "ok", data: {} }) });
		});
		await page.getByText("qwen3-8b (基座)").click();
		await page.locator("textarea").first().fill("测试基座");
		await clickSend(page);
		await page.waitForTimeout(1500);
		expect(requestBody).toBeTruthy();
		expect(requestBody?.model).toBe("qwen3-8b");
	});

	test("推理失败展示错误信息", async ({ page }) => {
		await loginAndGoto(page);
		await routeApi(page, async (_url, path, route) => {
			if (path === "/api/v1/inference/chat") {
				return route.fulfill({ status: 200, contentType: "text/event-stream", body: sseErrorBody("vLLM 服务不可用") });
			}
			return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 200, message: "ok", data: {} }) });
		});
		await page.locator("textarea").first().fill("触发错误");
		await clickSend(page);
		await expect(page.getByText("推理失败", { exact: false })).toBeVisible({ timeout: 10000 });
	});

	test("无 JS 运行时错误", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", err => errors.push(err.message));
		await loginAndGoto(page);
		await page.waitForTimeout(1000);
		expect(errors).toEqual([]);
	});
});
