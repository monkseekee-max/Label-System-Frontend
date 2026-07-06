import { useAuthStore } from "#src/store/auth";

/**
 * ADR-019 P0-4: label-system 前端不得伪造默认开发 token。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("label-system auth headers", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("VITE_API_BASE_URL", "/api");
		useAuthStore.setState({ token: "", refreshToken: "" });
		localStorage.clear();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
		vi.resetModules();
		localStorage.clear();
	});

	it("有 auth store token 时发送 Bearer token", async () => {
		useAuthStore.setState({ token: "jwt-token-from-store" });
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
		);
		globalThis.fetch = fetchMock as any;

		const { fetchAssets } = await import("#src/api/label-system");
		await fetchAssets();

		const request = fetchMock.mock.calls[0][0] as Request;
		expect(request.headers.get("Authorization")).toBe("Bearer jwt-token-from-store");
	});

	it("无 token 时直接抛出未认证错误", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as any;

		const { fetchAssets } = await import("#src/api/label-system");
		expect(() => fetchAssets()).toThrow(/未认证|缺少登录 token/i);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
