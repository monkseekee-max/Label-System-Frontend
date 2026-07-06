import type { AfterResponseHook, BeforeRequestHook, Options } from "ky";

import { loginPath } from "#src/router/extra-info";
import { useAuthStore } from "#src/store/auth";
import { usePreferencesStore } from "#src/store/preferences";
import ky from "ky";

import { AUTH_HEADER, LANG_HEADER } from "./constants";
import { handleErrorResponse } from "./error-response";
import { globalProgress } from "./global-progress";
import { goLogin } from "./go-login";
import { refreshTokenAndRetry } from "./refresh";

// 请求白名单, 请求白名单内的接口不需要携带 token
const requestWhiteList = ["/auth/login", "/auth/companies", loginPath];

// 请求超时时间
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 60000;

/**
 * P0-2 重试策略: 仅重试幂等方法 + 临时故障状态码.
 *
 * 历史问题: 旧配置只设 `retry.limit = 3`, ky 默认会重试 POST/PUT/DELETE,
 * 导致创建任务/提交审批/合并标注等写接口在网络抖动时被静默重复执行,
 * 产生重复数据/重复触发训练. 现在显式限定:
 * - methods: 只重试幂等读动词 (get/head/options/put), 排除 post/delete/patch
 * - statusCodes: 只重试网络/限流/临时服务故障, 业务错误 (400/401/403/404/422) 不重试
 */
export const RETRY_POLICY = {
	limit: 3,
	methods: ["get", "head", "options", "put"],
	statusCodes: [408, 429, 500, 502, 503, 504],
} as const satisfies Options["retry"];

/**
 * beforeRequest 钩子: 启动全局进度 + 注入鉴权/语言头.
 *
 * P0-1: 共享 /api 层只注入登录态 JWT (Bearer), 不再注入服务级 X-API-Key.
 * 原因: VITE_LLM_FACTORY_API_KEY 是服务/机器凭据, 进浏览器 bundle 后任何用户
 * 可从 devtools 提取并绕过前端直调后端. /api 代理背后的后端以 JWT 鉴权即可.
 */
export const beforeRequestHook: BeforeRequestHook = (request, options) => {
	const ignoreLoading = options.ignoreLoading;
	if (!ignoreLoading) {
		globalProgress.start();
		// 兜底: 超时后强制关闭进度, 防止 hang 死 (请求正常完成时 afterResponse 会先 done)
		setTimeout(() => {
			globalProgress.done();
		}, API_TIMEOUT);
	}
	// 不需要携带 token 的请求
	const requestPath = new URL(request.url).pathname;
	const isWhiteRequest = requestWhiteList.some(url => requestPath.endsWith(url));
	if (!isWhiteRequest) {
		const { token } = useAuthStore.getState();
		request.headers.set(AUTH_HEADER, `Bearer ${token}`);
	}
	// 语言等所有的接口都需要携带
	request.headers.set(LANG_HEADER, usePreferencesStore.getState().language);
};

/**
 * afterResponse 钩子: 关闭全局进度 + 错误语义化传播.
 *
 * P0-3: 非 401 错误响应必须 throw, 让 React Query 进入 isError 分支.
 * 历史问题: 旧实现 `return handleErrorResponse(response)` 把错误响应原样 resolve,
 * 导致 useQuery 的 isError 永远 false, 组件误以为数据加载成功, toast 弹了但页面
 * 显示空数据/旧数据且无错误态. 现在 handleErrorResponse 弹完 toast 后返回错误消息,
 * 本钩子用该消息 throw, 保证 HTTP 层失败时 Promise reject.
 */
export const afterResponseHook: AfterResponseHook = async (request, options, response) => {
	const ignoreLoading = options.ignoreLoading;
	if (!ignoreLoading) {
		globalProgress.done();
	}
	// 请求成功
	if (response.ok) {
		return response;
	}
	// 请求错误
	if (response.status === 401) {
		// 白名单请求 (如登录接口) 401 由调用方负责展示提示, 不跳转登录页
		const requestPath = new URL(request.url).pathname;
		const isWhiteRequest = requestWhiteList.some(url => requestPath.endsWith(url));
		if (isWhiteRequest) {
			throw await handleErrorResponse(response.clone());
		}
		// AUTH-D1 (ADR-021): 持有 refreshToken 时先静默续期重试, 失败再回登录
		const { refreshToken } = useAuthStore.getState();
		if (refreshToken) {
			return refreshTokenAndRetry(request, options, refreshToken);
		}
		if (location.pathname !== loginPath) {
			await handleErrorResponse(response.clone());
			goLogin();
		}
		return response;
	}
	// 非 401 错误: 弹 toast 后 throw ApiError, 让上游 (React Query) 进入 isError
	throw await handleErrorResponse(response);
};

const defaultConfig: Options = {
	// The input argument cannot start with a slash / when using prefixUrl option.
	prefixUrl: import.meta.env.VITE_API_BASE_URL,
	timeout: API_TIMEOUT,
	retry: RETRY_POLICY,
	hooks: {
		beforeRequest: [beforeRequestHook],
		afterResponse: [afterResponseHook],
	},
};

export const request = ky.create(defaultConfig);

export { ApiError } from "./api-error";
