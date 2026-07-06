import { factoryAuthHeaders } from "#src/api/llm-factory/factory-auth";
/**
 * P0-1: LLM-Factory 直连鉴权统一走登录用户 JWT.
 *
 * 历史问题: data-productivity / factory-client / cancelTrainingTask 各自从
 * VITE_LLM_FACTORY_TOKEN / VITE_LLM_FACTORY_API_KEY 读凭据, 这些 env 变量会进
 * 浏览器 bundle 被任意用户提取. 现在统一从 useAuthStore 取登录态 JWT,
 * 经同源 /api 代理, 后端以 JWT 鉴权.
 */
import { useAuthStore } from "#src/store/auth";

import { describe, expect, it } from "vitest";

describe("factoryAuthHeaders (P0-1)", () => {
	it("有 JWT 时返回 Bearer 头", () => {
		useAuthStore.setState({ token: "jwt-abc", refreshToken: "" });
		expect(factoryAuthHeaders()).toEqual({ Authorization: "Bearer jwt-abc" });
	});

	it("允许追加额外头 (如 Content-Type)", () => {
		useAuthStore.setState({ token: "jwt-abc", refreshToken: "" });
		expect(factoryAuthHeaders({ "Content-Type": "application/json" })).toEqual({
			"Authorization": "Bearer jwt-abc",
			"Content-Type": "application/json",
		});
	});

	it("无 JWT 时同步抛未认证错误", () => {
		useAuthStore.setState({ token: "", refreshToken: "" });
		expect(() => factoryAuthHeaders()).toThrow(/未认证/);
	});

	it("运行时不读取任何 env 服务密钥 (不进浏览器 bundle)", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const source = fs.readFileSync(
			path.resolve(process.cwd(), "src/api/llm-factory/factory-auth.ts"),
			"utf8",
		);
		// 守卫运行时读取 (允许注释记录历史)
		expect(source).not.toContain("import.meta.env.VITE_LLM_FACTORY_API_KEY");
		expect(source).not.toContain("import.meta.env.VITE_LLM_FACTORY_TOKEN");
		expect(source).not.toMatch(/headers?\[?["']X-API-Key["']\]?/);
	});
});
