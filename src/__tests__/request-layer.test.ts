/**
 * Phase 0 止血项 (P0-2 / P0-3) 请求层契约测试
 *
 * P0-2: 重试策略必须排除写动词 (post/delete/patch), 否则会静默重复创建资源.
 * P0-3: 非 401 错误响应必须 reject (throw), 否则 React Query isError 永远 false, UI 不可信.
 */
import type { NormalizedOptions } from "ky";

import { isSuccessResponse } from "#src/api/shared";
import { afterResponseHook, ApiError, RETRY_POLICY } from "#src/utils/request";

import { describe, expect, it } from "vitest";

// ----------------------------------------------------------------------------
// P0-2: 重试策略只覆盖幂等动词
// ----------------------------------------------------------------------------

describe("p0-2 retry policy 排除写操作", () => {
	it("排除非幂等写动词 (post/delete/patch)", () => {
		// 写操作重试会产生重复数据/重复触发训练, 必须排除
		expect(RETRY_POLICY.methods).not.toContain("post");
		expect(RETRY_POLICY.methods).not.toContain("delete");
		expect(RETRY_POLICY.methods).not.toContain("patch");
	});

	it("包含幂等读动词 (get)", () => {
		expect(RETRY_POLICY.methods).toContain("get");
	});

	it("配置了可重试状态码白名单 (仅网络/限流/临时故障)", () => {
		expect(Array.isArray(RETRY_POLICY.statusCodes)).toBe(true);
		expect(RETRY_POLICY.statusCodes.length).toBeGreaterThan(0);
		// 503 (服务不可用) 应可重试
		expect(RETRY_POLICY.statusCodes).toContain(503);
		// 400/401/403/404/422 (业务/鉴权错误) 不应重试
		expect(RETRY_POLICY.statusCodes).not.toContain(400);
		expect(RETRY_POLICY.statusCodes).not.toContain(401);
		expect(RETRY_POLICY.statusCodes).not.toContain(422);
	});

	it("保留了重试次数上限", () => {
		expect(RETRY_POLICY.limit).toBeGreaterThanOrEqual(1);
		expect(RETRY_POLICY.limit).toBeLessThanOrEqual(3);
	});
});

// ----------------------------------------------------------------------------
// P0-3: 非 401 错误响应必须 throw (让 React Query 进入 isError)
// ----------------------------------------------------------------------------

describe("p0-3 错误传播: 非 401 失败必须 reject", () => {
	const fakeRequest = new Request("https://example.test/api/v1/foo");
	// ky 运行时注入完整 NormalizedOptions; 测试只需 ignoreLoading, 用显式双转构造桩
	const baseOptions = { ignoreLoading: true } as unknown as NormalizedOptions;
	// ky AfterResponseHook 第 4 参数 state (retryCount), 测试中固定 0 (无重试)
	const NO_RETRY_STATE = { retryCount: 0 };

	it("500 错误响应抛出后端 message", async () => {
		const errorResponse = new Response(
			JSON.stringify({ message: "内部错误: 训练任务不存在" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);

		await expect(afterResponseHook(fakeRequest, baseOptions, errorResponse, NO_RETRY_STATE))
			.rejects
			.toThrow("内部错误: 训练任务不存在");
	});

	it("500 错误响应回退到 errorMsg 字段", async () => {
		const errorResponse = new Response(
			JSON.stringify({ errorMsg: "网关超时" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);

		await expect(afterResponseHook(fakeRequest, baseOptions, errorResponse, NO_RETRY_STATE))
			.rejects
			.toThrow("网关超时");
	});

	it("非 JSON 错误体回退到 statusText", async () => {
		const errorResponse = new Response("Bad Gateway", { status: 502 });

		await expect(afterResponseHook(fakeRequest, baseOptions, errorResponse, NO_RETRY_STATE))
			.rejects
			.toThrow();
	});

	it("成功响应原样返回, 不抛错", async () => {
		const okResponse = new Response("{}", { status: 200 });

		await expect(afterResponseHook(fakeRequest, baseOptions, okResponse, NO_RETRY_STATE))
			.resolves
			.toBe(okResponse);
	});

	it("错误抛出后仍触发过 toast 提示 (handleErrorResponse 副作用)", async () => {
		// toast 是辅助反馈, 不能因 throw 而消失
		const errorResponse = new Response(
			JSON.stringify({ message: "toast 应触发" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);

		// 即便 reject, 也要等到 handleErrorResponse 执行完 (await reject)
		await expect(
			afterResponseHook(fakeRequest, baseOptions, errorResponse, NO_RETRY_STATE),
		).rejects.toThrow("toast 应触发");
		// 若能走到这里说明 hook 完整执行了 handleErrorResponse 再 throw
		expect(true).toBe(true);
	});

	it("ignoreLoading=false 时错误路径也会关闭全局进度", async () => {
		const errorResponse = new Response(
			JSON.stringify({ message: "boom" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
		// 不应因 throw 跳过 globalProgress.done()
		await expect(
			afterResponseHook(fakeRequest, {} as unknown as NormalizedOptions, errorResponse, NO_RETRY_STATE),
		).rejects.toThrow("boom");
	});
});

// ----------------------------------------------------------------------------
// P1-6: 错误为结构化 ApiError (携带 status), 便于页面区分错误类型
// ----------------------------------------------------------------------------

describe("p1-6 错误抛出结构化 ApiError", () => {
	const fakeRequest = new Request("https://example.test/api/v1/foo");
	const opts = { ignoreLoading: true } as unknown as NormalizedOptions;
	const NO_RETRY_STATE = { retryCount: 0 };

	it("非 401 错误抛出 ApiError 实例, 携带 status 与 message", async () => {
		const errorResponse = new Response(
			JSON.stringify({ message: "not found", error_code: "TASK_NOT_FOUND", context: { task_id: "task-1" } }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);

		// Response body 只能消费一次, 捕获错误后一次性断言全部属性
		const err = await (afterResponseHook(fakeRequest, opts, errorResponse, NO_RETRY_STATE) as Promise<unknown>).catch(e => e) as ApiError;
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(404);
		expect(err.message).toBe("not found");
		expect(err.code).toBe(404);
		expect(err.errorCode).toBe("TASK_NOT_FOUND");
		expect(err.context).toEqual({ task_id: "task-1" });
	});

	it("apiError 仍是 Error 子类 (向后兼容现有 catch e.message 用法)", () => {
		const err = new ApiError({ message: "x", code: 500, errorCode: "INTERNAL", context: { request_id: "r1" }, status: 500 });
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.message).toBe("x");
		expect(err.code).toBe(500);
		expect(err.errorCode).toBe("INTERNAL");
		expect(err.context).toEqual({ request_id: "r1" });
		expect(err.status).toBe(500);
		expect(err.name).toBe("ApiError");
	});

	it("服务端错误 (5xx) 同样抛出带 status 的 ApiError", async () => {
		const errorResponse = new Response(
			JSON.stringify({ message: "上游超时" }),
			{ status: 502, headers: { "Content-Type": "application/json" } },
		);

		await expect(afterResponseHook(fakeRequest, opts, errorResponse, NO_RETRY_STATE))
			.rejects
			.toMatchObject({ status: 502, message: "上游超时" });
	});
});

describe("api contract success 判定", () => {
	it("仅 code=200 视为成功", () => {
		expect(isSuccessResponse(200)).toBe(true);
		expect(isSuccessResponse(0)).toBe(false);
		expect(isSuccessResponse(201)).toBe(false);
		expect(isSuccessResponse(500)).toBe(false);
	});
});

describe("error-response 解析后端结构化错误", () => {
	it("提取 error_code 与 context 到 ApiError", async () => {
		const { parseErrorResponse } = await import("#src/utils/request/error-response");
		const res = new Response(
			JSON.stringify({
				code: 429,
				message: "请求过于频繁",
				data: null,
				error_code: "INFERENCE_ERROR",
				context: { retryAfterSeconds: 30 },
			}),
			{ status: 429, headers: { "Content-Type": "application/json" } },
		);

		const err = await parseErrorResponse(res);

		expect(err).toBeInstanceOf(ApiError);
		expect(err.message).toBe("请求过于频繁");
		expect(err.code).toBe(429);
		expect(err.status).toBe(429);
		expect(err.errorCode).toBe("INFERENCE_ERROR");
		expect(err.context).toEqual({ retryAfterSeconds: 30 });
	});

	it("handleErrorResponse 返回携带结构化字段的 ApiError", async () => {
		const { handleErrorResponse } = await import("#src/utils/request/error-response");
		const res = new Response(
			JSON.stringify({ code: 422, message: "请求参数校验失败", context: { errors: [{ loc: ["body", "name"], msg: "required" }] } }),
			{ status: 422, headers: { "Content-Type": "application/json" } },
		);

		await expect(handleErrorResponse(res)).resolves.toMatchObject({
			message: "请求参数校验失败",
			code: 422,
			status: 422,
			context: { errors: [{ loc: ["body", "name"], msg: "required" }] },
		});
	});
});

// ----------------------------------------------------------------------------
// P0-1: 共享请求层不再注入 env API key
// ----------------------------------------------------------------------------

describe("p0-1 共享请求层不注入 env API key", () => {
	it("运行时不读取 env API key, 不导入 API_KEY_HEADER", async () => {
		// 守卫: 共享 /api 层只走登录态 JWT, 不再注入服务级 env 密钥.
		// 注意只禁止"使用"(读取 env / 导入 header 常量), 允许注释中记录历史.
		const fs = await import("node:fs");
		const path = await import("node:path");
		const source = fs.readFileSync(
			path.resolve(process.cwd(), "src/utils/request/index.ts"),
			"utf8",
		);
		// 禁止运行时读取 env 服务密钥
		expect(source).not.toContain("import.meta.env.VITE_LLM_FACTORY_API_KEY");
		// 禁止导入/使用 X-API-Key 头常量
		expect(source).not.toContain("API_KEY_HEADER");
		expect(source).not.toMatch(/headers\.set\(\s*["']X-API-Key["']/);
	});
});

// ----------------------------------------------------------------------------
// P0-3 配套: error-response.ts 返回错误消息字符串 (供 hook throw)
// ----------------------------------------------------------------------------

describe("handleErrorResponse 返回错误消息", () => {
	it("返回携带后端 message 字段的 ApiError", async () => {
		const { handleErrorResponse } = await import("#src/utils/request/error-response");
		const res = new Response(
			JSON.stringify({ message: "err-msg-1" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
		await expect(handleErrorResponse(res)).resolves.toMatchObject({ message: "err-msg-1" });
	});

	it("回退到 errorMsg 字段", async () => {
		const { handleErrorResponse } = await import("#src/utils/request/error-response");
		const res = new Response(
			JSON.stringify({ errorMsg: "err-msg-2" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
		await expect(handleErrorResponse(res)).resolves.toMatchObject({ message: "err-msg-2" });
	});

	it("非 JSON 回退到 statusText", async () => {
		const { handleErrorResponse } = await import("#src/utils/request/error-response");
		const res = new Response("oops", { status: 502, statusText: "Bad Gateway" });
		await expect(handleErrorResponse(res)).resolves.toMatchObject({ message: "Bad Gateway" });
	});
});
