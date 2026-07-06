import { useAuthStore } from "#src/store/auth";

import { useUserStore } from "#src/store/user";
/**
 * factory-client 鉴权与租户上下文测试
 *
 * 验证多租户安全边界在前端真正生效 (P0-1):
 * - token 从 useAuthStore 取 (登录态 JWT), 携带 Bearer
 * - companyId 从 useUserStore 取 (非 localStorage)
 * - 无 token 时显式抛未认证 (不再回退 X-API-Key 服务密钥)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("factory-client 鉴权", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.stubEnv("VITE_LLM_FACTORY_BASE_URL", "http://test:9090");
		// 即便误配了 env 服务密钥, 也不应被使用
		vi.stubEnv("VITE_LLM_FACTORY_API_KEY", "should_be_ignored");
		// 清空 store
		useAuthStore.setState({ token: "", refreshToken: "" });
		useUserStore.setState({ companyId: undefined });
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
	});

	it("登录态有 token 时, 携带 Bearer JWT (多租户生效)", async () => {
		useAuthStore.setState({ token: "a".repeat(60) });
		useUserStore.setState({ companyId: 2 });

		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 200, message: "ok", data: { gpuList: [] } }), { status: 200 }),
		);
		globalThis.fetch = fetchMock as any;

		const { factoryApi } = await import("#src/api/llm-factory/factory-client");
		await factoryApi.getGpuList();

		const callArgs = fetchMock.mock.calls[0];
		const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
		expect(headers.Authorization).toBe(`Bearer ${"a".repeat(60)}`);
		// 不再注入 X-API-Key (服务密钥不属于浏览器)
		expect(headers["X-API-Key"]).toBeUndefined();
	});

	it("登录态有 companyId 时, 查询参数带正确租户", async () => {
		useAuthStore.setState({ token: "t".repeat(60) });
		useUserStore.setState({ companyId: 5 });

		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 200, message: "ok", data: { records: [], total: 0 } }), { status: 200 }),
		);
		globalThis.fetch = fetchMock as any;

		const { factoryApi } = await import("#src/api/llm-factory/factory-client");
		await factoryApi.getDatasets();

		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain("companyId=5");
	});

	it("无 token 时显式抛未认证 (不再回退 X-API-Key)", async () => {
		useAuthStore.setState({ token: "" });

		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as any;

		const { factoryApi } = await import("#src/api/llm-factory/factory-client");
		await expect(factoryApi.getGpuList()).rejects.toThrow(/未认证/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("companyId 缺省时默认 1", async () => {
		useAuthStore.setState({ token: "t".repeat(60) });
		useUserStore.setState({ companyId: undefined });

		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 200, message: "ok", data: { records: [], total: 0 } }), { status: 200 }),
		);
		globalThis.fetch = fetchMock as any;

		const { factoryApi } = await import("#src/api/llm-factory/factory-client");
		await factoryApi.getDatasets();

		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain("companyId=1");
	});
});
