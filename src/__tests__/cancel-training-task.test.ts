import { cancelTrainingTask } from "#src/api/llm-factory";
import { useAuthStore } from "#src/store/auth";

/**
 * 训练任务终止 API 测试 (A4 / Phase0 P0-1)
 *
 * 验证 cancelTrainingTask:
 * - 正确调用后端 POST /api/v1/tasks/{id}/cancel
 * - 鉴权统一走登录态 JWT (Bearer), 不再使用 env X-API-Key
 * (mock fetch, 不依赖真实后端)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("cancelTrainingTask", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.stubEnv("VITE_LLM_FACTORY_BASE_URL", "http://test:9090");
		// 即便误配了 env 服务密钥, 也不应被使用
		vi.stubEnv("VITE_LLM_FACTORY_API_KEY", "should_be_ignored");
		vi.stubEnv("VITE_ENABLE_MOCK_FALLBACK", "true");
		useAuthStore.setState({ token: "jwt-token-abc", refreshToken: "" });
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
	});

	it("成功终止: 调用正确端点 + 方法 + JWT 鉴权头", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ task_id: "job-123", status: "cancelled" }), { status: 200 }),
		);
		globalThis.fetch = fetchMock as any;

		const result = await cancelTrainingTask("job-123");

		expect(fetchMock).toHaveBeenCalledWith(
			"http://test:9090/api/v1/tasks/job-123/cancel",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ Authorization: "Bearer jwt-token-abc" }),
			}),
		);
		// 不再注入 X-API-Key (服务密钥不属于浏览器)
		const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
		expect(headers["X-API-Key"]).toBeUndefined();
		expect(result).toEqual({ task_id: "job-123", status: "cancelled" });
	});

	it("未登录时抛未认证错误, 不调用 fetch", async () => {
		useAuthStore.setState({ token: "" });
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as any;

		await expect(cancelTrainingTask("job-x")).rejects.toThrow(/未认证/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("失败时抛出含后端 detail 的错误", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ detail: "无法取消: job-x (不存在)" }), { status: 400 }),
		) as any;

		await expect(cancelTrainingTask("job-x")).rejects.toThrow("无法取消: job-x (不存在)");
	});

	it("后端返回非JSON错误体时, 降级为状态码错误", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response("Internal Server Error", { status: 500 }),
		) as any;

		await expect(cancelTrainingTask("job-err")).rejects.toThrow("终止训练失败: 500");
	});
});
