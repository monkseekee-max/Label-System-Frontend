import { useAuthStore } from "#src/store/auth";

import { useUserStore } from "#src/store/user";
/**
 * ADR-019 P0-1: 生产禁用 Mock fallback
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("factory mock fallback gate", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("VITE_LLM_FACTORY_BASE_URL", "http://test:9090");
		vi.stubEnv("VITE_LLM_FACTORY_API_KEY", "test_key");
		useAuthStore.setState({ token: "", refreshToken: "" });
		useUserStore.setState({ companyId: undefined });
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("fallback enabled 时真实 API 失败仍返回 mock", async () => {
		vi.stubEnv("VITE_ENABLE_MOCK_FALLBACK", "true");
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("backend down")) as any;

		const { fetchTrainingJobList, isMockFallbackEnabled } = await import("#src/api/llm-factory");
		const res = await fetchTrainingJobList({ pageNo: 1, pageSize: 10 });

		expect(isMockFallbackEnabled()).toBe(true);
		expect(res.success).toBe(true);
		expect(res.result?.records.length).toBeGreaterThan(0);
		expect(res.result?.records[0].runId).toMatch(/^run-|^task-/);
	});

	it("fallback disabled 时真实 API 失败直接抛结构化错误且不返回 mock", async () => {
		vi.stubEnv("VITE_ENABLE_MOCK_FALLBACK", "false");
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("backend down")) as any;

		const { fetchTrainingJobList, isMockFallbackEnabled } = await import("#src/api/llm-factory");

		expect(isMockFallbackEnabled()).toBe(false);
		await expect(fetchTrainingJobList({ pageNo: 1, pageSize: 10 })).rejects.toMatchObject({
			name: "FactoryApiError",
			endpoint: "fetchTrainingJobList",
			mockFallbackEnabled: false,
		});
	});

	it("production 环境默认禁用 fallback", async () => {
		vi.unstubAllEnvs();
		vi.stubEnv("PROD", true as any);
		vi.stubEnv("DEV", false as any);
		vi.stubEnv("VITE_LLM_FACTORY_BASE_URL", "http://test:9090");
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("backend down")) as any;

		const { fetchDatasetList, isMockFallbackEnabled } = await import("#src/api/llm-factory");

		expect(isMockFallbackEnabled()).toBe(false);
		await expect(fetchDatasetList()).rejects.toMatchObject({
			name: "FactoryApiError",
			endpoint: "fetchDatasetList",
		});
	});
});
