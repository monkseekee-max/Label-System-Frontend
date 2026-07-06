import { setRouterRuntime } from "#src/router/runtime";
/**
 * Phase0 P0-4: logout 必须保证本地 reset 执行.
 *
 * 历史问题: `await fetchLogout(); get().reset();` —— fetchLogout 网络失败时抛错,
 * reset 永远不执行, 用户卡在"已点退出但实际还登录"的诡异态 (token 还在, 路由还守着).
 *
 * 契约: logout 是用户明确意图, 后端调用是 best-effort, 失败时仍必须完成本地登出.
 */
import { useAccessStore } from "#src/store/access";
import { useAuthStore } from "#src/store/auth";
import { useTabsStore } from "#src/store/tabs";
import { useUserStore } from "#src/store/user";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// mock 后端 user API, 仅控制 fetchLogout 的成败
vi.mock("#src/api/user", () => ({
	fetchLogin: vi.fn(),
	fetchLogout: vi.fn(),
	fetchRefreshToken: vi.fn(),
	fetchUserInfo: vi.fn(),
}));

describe("p0-4 logout 保证本地 reset", () => {
	beforeAll(() => {
		// access.reset() 调用 getRouterRuntime()._internalSetRoutes, 注入空桩隔离路由副作用
		setRouterRuntime(
			{ _internalSetRoutes: () => {}, patchRoutes: () => {} } as any,
			[],
		);
	});

	beforeEach(() => {
		vi.clearAllMocks();
		// 预置"已登录"状态
		useAuthStore.setState({ token: "stale-token", refreshToken: "stale-refresh" });
		useUserStore.setState({ username: "alice", position: "ADMIN" });
		useAccessStore.setState({ routeList: [{ path: "/home" }] as any });
		useTabsStore.setState({ activeKey: "/home" });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("fetchLogout 成功时正常清空本地状态", async () => {
		const { fetchLogout } = await import("#src/api/user");
		vi.mocked(fetchLogout).mockResolvedValueOnce(undefined as any);

		await useAuthStore.getState().logout();

		expect(useAuthStore.getState().token).toBe("");
		expect(useAuthStore.getState().refreshToken).toBe("");
		expect(useUserStore.getState().username).toBe("");
	});

	it("fetchLogout 网络失败时仍完成本地登出 (不抛错给调用方)", async () => {
		const { fetchLogout } = await import("#src/api/user");
		vi.mocked(fetchLogout).mockRejectedValueOnce(new Error("network down"));

		// logout 应 resolve (best-effort 后端调用失败不阻塞本地登出)
		await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();

		// 关键断言: 尽管后端失败, 本地 token / refreshToken 必须已清空
		expect(useAuthStore.getState().token).toBe("");
		expect(useAuthStore.getState().refreshToken).toBe("");
		expect(useUserStore.getState().username).toBe("");
	});

	it("fetchLogout 失败时也清空权限路由与标签页", async () => {
		const { fetchLogout } = await import("#src/api/user");
		vi.mocked(fetchLogout).mockRejectedValueOnce(new Error("network down"));

		await useAuthStore.getState().logout();

		expect(useAccessStore.getState().routeList).toEqual([]);
		expect(useTabsStore.getState().activeKey).toBe("");
	});
});
