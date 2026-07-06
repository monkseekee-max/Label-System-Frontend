/**
 * ADR-019 P0-1 / Phase0: 数据生产力 API 鉴权统一走登录用户 JWT.
 *
 * 历史实现从 VITE_LLM_FACTORY_API_KEY / VITE_LLM_FACTORY_TOKEN 读凭据直连主服务,
 * 这些 env 变量会进浏览器 bundle 被任意用户提取. 现在统一从 useAuthStore 取 JWT.
 */
import { useAuthStore } from "#src/store/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("data-productivity 鉴权走登录态 JWT", () => {
	beforeEach(() => {
		useAuthStore.setState({ token: "", refreshToken: "" });
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	function mockFetchOk() {
		return vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
	}

	it("登录态有 token 时携带 Bearer JWT", async () => {
		useAuthStore.setState({ token: "jwt-token-xyz" });
		const fetchMock = mockFetchOk();
		globalThis.fetch = fetchMock as typeof fetch;

		const { fetchAnnotatorStats } = await import("#src/api/llm-factory/data-productivity");
		await fetchAnnotatorStats();

		const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer jwt-token-xyz");
		// 不再注入任何 X-API-Key (服务密钥不属于浏览器)
		expect(headers["X-API-Key"]).toBeUndefined();
	});

	it("pOST 请求同时携带 Bearer 与 Content-Type", async () => {
		useAuthStore.setState({ token: "jwt-token-xyz" });
		const fetchMock = mockFetchOk();
		globalThis.fetch = fetchMock as typeof fetch;

		const { batchUpdateStatus } = await import("#src/api/llm-factory/data-productivity");
		await batchUpdateStatus([1, 2], "approved");

		const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer jwt-token-xyz");
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("未登录 (无 JWT) 时同步抛未认证错误且不调用 fetch", async () => {
		useAuthStore.setState({ token: "" });
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as typeof fetch;

		const { batchDeleteAnnotations } = await import("#src/api/llm-factory/data-productivity");
		await expect(batchDeleteAnnotations([1])).rejects.toThrow(/未认证/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("不再读取任何 env 服务密钥", async () => {
		// 即便误配了 env 服务密钥, 也不应被使用 (安全边界)
		vi.stubEnv("VITE_LLM_FACTORY_API_KEY", "should_be_ignored");
		vi.stubEnv("VITE_LLM_FACTORY_TOKEN", "should_be_ignored");
		useAuthStore.setState({ token: "jwt-token-xyz" });
		const fetchMock = mockFetchOk();
		globalThis.fetch = fetchMock as typeof fetch;

		const { exportAnnotations } = await import("#src/api/llm-factory/data-productivity");
		await exportAnnotations({ format: "jsonl" });

		const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer jwt-token-xyz");
		expect(headers["X-API-Key"]).toBeUndefined();
	});
});
