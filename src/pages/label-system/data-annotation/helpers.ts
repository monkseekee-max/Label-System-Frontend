// data-annotation 纯函数 (P2-10 Phase A: 从 index.tsx 提取, 全部可单测)
import type { QAItem } from "#src/api/label-system";

import { PENDING_REVIEW_STATUSES, REVIEWED_OK_STATUSES } from "./constants";

export const isReviewedOk = (s?: string): boolean => !!s && REVIEWED_OK_STATUSES.has(s);
export const isPendingReview = (s?: string): boolean => !!s && PENDING_REVIEW_STATUSES.has(s);

// QAItem 的可见状态色: 通过=绿 / 待审=橙 / 驳回=红 / 其他=蓝
export function statusColor(s?: string): string {
	if (isReviewedOk(s))
		return "green";
	if (isPendingReview(s))
		return "orange";
	if (s === "reviewed_reject" || s === "rejected")
		return "red";
	return "blue";
}

// —— 工具函数 (继承源项目) ——
export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export function formatRegionLabel(sel: { normalized: { x: number, y: number, width: number, height: number } } | null): string {
	if (!sel)
		return "";
	return `x:${Math.round(sel.normalized.x * 100)}%,y:${Math.round(sel.normalized.y * 100)}%,w:${Math.round(sel.normalized.width * 100)}%,h:${Math.round(sel.normalized.height * 100)}%`;
}

export function formatTimestampTag(ts: number): string {
	return `${ts.toFixed(3)}s`;
}

export function buildWindowSampleTimestamps(start: number, end: number, sampleCount: number): number[] {
	const n = Math.min(6, Math.max(2, sampleCount));
	const out: number[] = [];
	for (let i = 0; i < n; i++) {
		out.push(Number((start + ((end - start) * i) / Math.max(1, n - 1)).toFixed(3)));
	}
	return out;
}

export function getRecommendation(item: QAItem | null) {
	if (!item)
		return { label: "等待选择标注项", description: "先从左侧列表选择一条标注项。", tone: "neutral" as const };
	if (isReviewedOk(item.status))
		return { label: "已完成审核闭环", description: "已通过审核，可进入训练条件池。", tone: "green" as const };
	if (isPendingReview(item.status))
		return { label: "等待审核裁决", description: "已进入审核流，重点核对证据与推理。", tone: "blue" as const };
	if (item.score_bucket === "green")
		return { label: "建议轻量抽检后归档", description: "高置信公共知识，通常无需重度改写。", tone: "green" as const };
	if (item.score_bucket === "orange")
		return { label: "建议优先复核", description: "模型答案存在分歧，建议补充证据或澄清推理。", tone: "orange" as const };
	return { label: "必须人工标注", description: "低置信或高分歧样本，直接影响训练质量。", tone: "red" as const };
}

export function previewText(...values: Array<string | null | undefined>): string {
	const v = values.map(x => (x || "").trim()).find(x => x.length > 0);
	if (!v)
		return "等待补充答案、证据或推理后进入审核流。";
	return v.length > 96 ? `${v.slice(0, 96)}…` : v;
}

// hex (#rgb / #rrggbb) → rgba 字符串, 用于在图片上绘制半透明叠加 (选区高亮)
// alpha 失败回退为 1, 保证总能返回有效颜色值
export function hexToRgba(hex: string, alpha: number): string {
	const h = hex.replace("#", "");
	const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
	const r = Number.parseInt(full.slice(0, 2), 16) || 0;
	const g = Number.parseInt(full.slice(2, 4), 16) || 0;
	const b = Number.parseInt(full.slice(4, 6), 16) || 0;
	const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}
