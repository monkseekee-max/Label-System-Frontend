/**
 * llm-factory 数据生产力 API (阶段C 产品体验)
 *
 * 后端能力: 数据导出 / 批量操作 / 标注员统计.
 * 经同源 /api 代理到 llm-factory 主服务 (默认 9090), 鉴权用登录态 JWT.
 *
 * P0-1 安全修正: 鉴权统一走 factoryAuthHeaders (useAuthStore JWT),
 * 不再读取 VITE_LLM_FACTORY_TOKEN / VITE_LLM_FACTORY_API_KEY (会进浏览器 bundle).
 */
import { isSuccessResponse } from "#src/api/shared";

import { factoryAuthHeaders } from "./factory-auth";

const LLM_FACTORY_BASE = import.meta.env.VITE_LLM_FACTORY_BASE_URL || "";

/** 导出标注数据 (jsonl/csv) → 触发浏览器下载 */
export async function exportAnnotations(params: { format?: "jsonl" | "csv", status?: string } = {}) {
	const qs = new URLSearchParams();
	if (params.format)
		qs.set("format", params.format);
	if (params.status)
		qs.set("status", params.status);
	const resp = await fetch(
		`${LLM_FACTORY_BASE}/api/v1/data/export?${qs.toString()}`,
		{ headers: factoryAuthHeaders() },
	);
	if (!isSuccessResponse(resp.status))
		throw new Error(`导出失败: ${resp.status}`);
	const blob = await resp.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `annotations.${params.format || "jsonl"}`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/** 批量更新标注状态 */
export async function batchUpdateStatus(ids: number[], status: string) {
	const resp = await fetch(`${LLM_FACTORY_BASE}/api/v1/data/batch-update`, {
		method: "POST",
		headers: factoryAuthHeaders({ "Content-Type": "application/json" }),
		body: JSON.stringify({ ids, status }),
	});
	if (!isSuccessResponse(resp.status))
		throw new Error(`批量更新失败: ${resp.status}`);
	return resp.json();
}

/** 批量删除 (软删除) */
export async function batchDeleteAnnotations(ids: number[]) {
	const resp = await fetch(`${LLM_FACTORY_BASE}/api/v1/data/batch-delete`, {
		method: "POST",
		headers: factoryAuthHeaders({ "Content-Type": "application/json" }),
		body: JSON.stringify({ ids }),
	});
	if (!isSuccessResponse(resp.status))
		throw new Error(`批量删除失败: ${resp.status}`);
	return resp.json();
}

/** 标注员工作量统计 */
export async function fetchAnnotatorStats() {
	const resp = await fetch(`${LLM_FACTORY_BASE}/api/v1/metrics/annotator-stats`, {
		headers: factoryAuthHeaders(),
	});
	if (!isSuccessResponse(resp.status))
		throw new Error(`获取统计失败: ${resp.status}`);
	return resp.json();
}
