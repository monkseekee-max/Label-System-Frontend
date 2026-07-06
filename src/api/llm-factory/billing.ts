/**
 * 计费中心 API 客户端 (原生页面, 后端代理 new-api).
 *
 * 后端路由 (src/app/billing/routes.py) 用管理员凭证调 new-api,
 * 浏览器永不直连 new-api. 本文件仅与主 API (9090, 经 vite /api 代理) 通信.
 */

import { request } from "#src/utils/request";

const API = "v1/billing";

/** 通用 JSON 头 (token 由 request 拦截器自动注入 Bearer) */
function headers(extra?: Record<string, string>): Record<string, string> {
	return { "Content-Type": "application/json", ...extra };
}

// —— 额度 / 统计 ——
export interface QuotaData {
	quota: number
	used_quota: number
	remaining_yuan: number
	used_yuan: number
}

export interface BillingStats {
	quota: number
	rpm: number
	tpm: number
}

export function fetchQuota() {
	return request.get(`${API}/quota`, { headers: headers() }).json<{ success: boolean, data: QuotaData, error?: string }>();
}

export function fetchStats() {
	return request.get(`${API}/stats`, { headers: headers() }).json<{ success: boolean, data: BillingStats, error?: string }>();
}

// —— 令牌 ——
export interface BillingToken {
	id: number
	name: string
	key: string // new-api 返回脱敏 key (cgmK**********hWVm)
	status: number // 1=启用 2=禁用 3=过期
	unlimited_quota: boolean
	remain_quota: number
	used_quota: number
	group: string
	expired_time: number // -1=永不过期
	created_time: number
	accessed_time: number
	model_limits_enabled: boolean
	model_limits: string
}

export interface TokenListResponse {
	success: boolean
	data: { page: number, page_size: number, total: number, items: BillingToken[] }
	message?: string
}

export function fetchTokens() {
	return request.get(`${API}/tokens`, { headers: headers() }).json<TokenListResponse>();
}

export function createToken(payload: { name: string, unlimited_quota?: boolean, remain_quota?: number, group?: string }) {
	return request.post(`${API}/tokens`, { json: payload, headers: headers() }).json<TokenListResponse>();
}

export function deleteToken(id: number) {
	return request.delete(`${API}/tokens/${id}`, { headers: headers() }).json<{ success: boolean, message?: string }>();
}

export function revealTokenKey(id: number) {
	return request.post(`${API}/tokens/${id}/key`, { headers: headers() }).json<{ success: boolean, data: { key: string }, message?: string }>();
}

// —— 用量日志 ——
export interface BillingLog {
	id: number
	created_at: number
	type: number // 1=充值 2=消费 3=管理 4=错误
	content: string
	username: string
	token_name: string
	model_name: string
	quota: number
	prompt_tokens: number
	completion_tokens: number
	use_time: number
	is_stream: boolean
	channel: number
	channel_name: string
	group: string
}

export interface LogListResponse {
	success: boolean
	data: { page: number, page_size: number, total: number, items: BillingLog[] }
	message?: string
}

export function fetchLogs(params: { page?: number, page_size?: number, type?: number, model?: string, token_name?: string } = {}) {
	return request
		.get(`${API}/logs`, { searchParams: params, headers: headers() })
		.json<LogListResponse>();
}

// —— 充值 ——
export interface RechargeOrder {
	order_id: string
	amount_yuan: number
	quota: number
	status: "pending" | "paid" | "failed"
	created_at: number
	paid_at?: number
	qr_content: string
}

export function createRechargeOrder(amount: number) {
	return request
		.post(`${API}/create-order`, { json: { amount }, headers: headers() })
		.json<{ success: boolean, data: RechargeOrder, error?: string }>();
}

export function payRechargeOrder(orderId: string) {
	return request
		.post(`${API}/order/${orderId}/pay`, { headers: headers() })
		.json<{ success: boolean, order?: RechargeOrder, message?: string, error?: string }>();
}
