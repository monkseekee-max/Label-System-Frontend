import type { AuditLogRecord } from "#src/api/audit";
import type { GpuMetric, SystemInfo, TrainingDashboard } from "#src/api/llm-factory/ops-board";
import { describeAuditAction } from "#src/api/audit";

// ============================================================
// 运营看板派生数据 (纯函数, 从真实后端响应派生展示对象, 无硬编码).
// ============================================================

/** 最近活动展示项 (从审计日志派生). */
export interface ActivityItem {
	key: string
	type: "success" | "running" | "pending" | "error"
	message: string
	time: string
}

/** 服务健康展示项 (从 /system/info 的 vllm 状态派生, 真实 running). */
export interface ServiceHealthCard {
	key: string
	name: string
	port?: number
	healthy: boolean
	detail: string
}

/** 将 ISO 时间转为相对时间描述 (x 分钟前 / x 小时前 / x 天前). */
export function relativeTime(iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then))
		return iso;
	const diffSec = Math.max(0, (Date.now() - then) / 1000);
	if (diffSec < 60)
		return `${Math.floor(diffSec)} 秒前`;
	if (diffSec < 3600)
		return `${Math.floor(diffSec / 60)} 分钟前`;
	if (diffSec < 86400)
		return `${Math.floor(diffSec / 3600)} 小时前`;
	return `${Math.floor(diffSec / 86400)} 天前`;
}

/** 审计 action → 活动类型颜色 (用于最近活动圆点). */
function actionToActivityType(action: string): ActivityItem["type"] {
	if (action.includes("failed") || action.includes("failing"))
		return "error";
	if (action.includes("started"))
		return "running";
	if (action.includes("pending") || action.includes("waiting"))
		return "pending";
	return "success";
}

/** 从真实审计日志派生最近活动列表. */
export function deriveActivity(logs: AuditLogRecord[]): ActivityItem[] {
	return logs.map(log => ({
		key: String(log.id),
		type: actionToActivityType(log.action),
		message: describeAuditAction(log.action, log),
		time: relativeTime(log.createdAt),
	}));
}

/** 从 /system/info 派生服务健康卡片 (vLLM 文本/多模态, 真实 running 状态). */
export function deriveServiceHealth(info: SystemInfo): ServiceHealthCard[] {
	const cards: ServiceHealthCard[] = [];
	const { text, multimodal } = info.vllm;
	cards.push({
		key: "vllm-text",
		name: "vLLM 文本推理",
		port: text.port,
		healthy: text.running,
		detail: text.models.length > 0 ? `模型: ${text.models.join(", ")}` : "无加载模型",
	});
	cards.push({
		key: "vllm-mm",
		name: "vLLM 多模态推理",
		port: multimodal.port,
		healthy: multimodal.running,
		detail: multimodal.models.length > 0 ? `模型: ${multimodal.models.join(", ")}` : "无加载模型",
	});
	// 训练调度器: 从 tasks.running 派生
	cards.push({
		key: "training",
		name: "训练调度器",
		healthy: true, // BFF 本身在线即调度器可达
		detail: `运行中任务: ${info.tasks.running}`,
	});
	return cards;
}

/** 从真实 GPU 列表派生仪表盘汇总 (动态 N 块, 非硬编码 4 块). */
export function deriveGpuSummary(gpus: GpuMetric[]) {
	if (gpus.length === 0)
		return { count: 0, totalVram: 0, usedVram: 0, busyCount: 0, freeRatio: 0 };
	const totalVram = gpus.reduce((s, g) => s + g.vramTotal, 0);
	const usedVram = gpus.reduce((s, g) => s + g.vramUsed, 0);
	const busyCount = gpus.filter(g => g.status === "busy").length;
	const freeRatio = totalVram > 0 ? usedVram / totalVram : 0;
	return {
		count: gpus.length,
		totalVram: Math.round(totalVram * 10) / 10,
		usedVram: Math.round(usedVram * 10) / 10,
		busyCount,
		freeRatio: Math.round(freeRatio * 1000) / 10, // 已用百分比
	};
}

/** 从训练看板 + 系统总览派生训练产出汇总 (真实 avg_loss/trainings/models/eval). */
export function deriveTrainingSummary(dash: TrainingDashboard, info: SystemInfo) {
	return {
		totalTrainings: dash.total_trainings ?? info.tasks.running ?? 0,
		totalModels: dash.flywheel.models ?? 0,
		avgLoss: dash.summary.avg_loss ?? null,
		activeLora: info.lora.active ?? null,
		totalEvals: info.eval.total_completed ?? 0,
		totalAnnotations: info.data.total_annotations ?? 0,
	};
}
