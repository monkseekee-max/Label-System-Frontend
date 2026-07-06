import type { GateResult, TrainingJob, TrainingJobListParams, TrainingStatus, TriggerMode } from "./types";
import { isSuccessResponse } from "#src/api/shared";
import { factoryAuthHeaders } from "./factory-auth";
import { factoryApi } from "./factory-client";
import { delay, toApiResponse, withFallback } from "./shared";

const MOCK_TRAINING_JOBS: TrainingJob[] = [
	{
		id: "task-018",
		runId: "run-20250611-001",
		triggerMode: "SEMI_AUTO",
		baseModel: "Qwen3-8B",
		loraConfig: "Rank=16",
		dataSize: 12458,
		status: "RUNNING",
		pipelineProgress: 4, // 4/7 steps done
		gateResult: "PASS",
		duration: 32,
		completedAt: "",
	},
	{
		id: "task-017",
		runId: "run-20250610-008",
		triggerMode: "AUTO",
		baseModel: "Qwen3-8B",
		loraConfig: "Rank=16",
		dataSize: 8932,
		status: "COMPLETED",
		pipelineProgress: 7, // all done
		gateResult: "PASS",
		duration: 145,
		completedAt: "2025-06-10T18:32:00Z",
	},
	{
		id: "task-016",
		runId: "run-20250610-007",
		triggerMode: "MANUAL",
		baseModel: "Qwen3.5-4B",
		loraConfig: "Rank=32",
		dataSize: 5621,
		status: "FAILED",
		pipelineProgress: 3,
		gateResult: "FAIL",
		duration: 67,
		completedAt: "2025-06-10T16:45:00Z",
	},
	{
		id: "task-015",
		runId: "run-20250609-006",
		triggerMode: "SEMI_AUTO",
		baseModel: "Qwen3.5-4B",
		loraConfig: "Rank=8",
		dataSize: 15234,
		status: "COMPLETED",
		pipelineProgress: 7,
		gateResult: "WARN",
		duration: 188,
		completedAt: "2025-06-09T22:18:00Z",
	},
];

// Training Jobs
export function fetchTrainingJobList(params?: TrainingJobListParams) {
	const mock = () => delay(300).then(() => {
		let filtered = [...MOCK_TRAINING_JOBS];
		if (params?.keyword) {
			filtered = filtered.filter(j => j.runId.includes(params.keyword!) || j.id.includes(params.keyword!));
		}
		if (params?.status) {
			filtered = filtered.filter(j => j.status === params.status);
		}
		if (params?.triggerMode) {
			filtered = filtered.filter(j => j.triggerMode === params.triggerMode);
		}
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 10;
		const start = (pageNo - 1) * pageSize;
		const records = filtered.slice(start, start + pageSize);
		return toApiResponse({ code: 200, message: "success", data: { records, total: filtered.length, pageNo, pageSize } });
	});
	return withFallback(async () => {
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 10;
		const offset = (pageNo - 1) * pageSize;
		const res = await factoryApi.getTasks(undefined, params?.status as string | undefined, pageSize, offset);
		const records: TrainingJob[] = res.tasks.map(t => ({
			id: t.runId,
			runId: t.runId,
			triggerMode: (t.triggerMode as TriggerMode) || "MANUAL",
			baseModel: t.modelName,
			loraConfig: t.loraRank || "rank=16",
			dataSize: 0,
			status: _mapTrainingStatus(t.status),
			pipelineProgress: t.pipelineProgress?.stepsTotal ? Math.round(t.pipelineProgress.stepsCompleted / t.pipelineProgress.stepsTotal * 7) : 0,
			gateResult: (t.gate as GateResult) || "PASS",
			duration: t.duration,
			completedAt: t.completedAt || "",
		}));
		return { records, total: res.total, pageNo, pageSize };
	}, mock);
}

function _mapTrainingStatus(raw: string): TrainingStatus {
	const s = (raw || "PENDING").toUpperCase();
	if (["PENDING", "RUNNING", "COMPLETED", "FAILED"].includes(s))
		return s as TrainingStatus;
	return "PENDING";
}

export function fetchTrainingJobDetail(id: string) {
	return withFallback(async () => {
		const t = await factoryApi.getTaskStatus(id);
		const meta = (t.metadata || {}) as Record<string, number | string>;
		return {
			id: t.task_id,
			runId: t.task_id,
			triggerMode: String(t.trigger_mode || "manual").toUpperCase() as TriggerMode,
			baseModel: String(meta.model_key || meta.modelKey || "qwen3-8b"),
			loraConfig: meta.lora_rank ? `Rank=${meta.lora_rank}` : "rank=16",
			dataSize: Number(meta.data_size || 0),
			status: _mapRunStatus(t.status),
			pipelineProgress: t.pipeline_progress?.steps_total ? Math.round(t.pipeline_progress.steps_completed / t.pipeline_progress.steps_total * 7) : 0,
			gateResult: (t.gate?.passed === false ? "FAIL" : "PASS") as GateResult,
			gateReason: t.gate?.reason || undefined,
			duration: t.duration_seconds ? Math.round(t.duration_seconds / 60) : 0,
			completedAt: t.completed_at || "",
		};
	}, () => delay(200).then(() => {
		const job = MOCK_TRAINING_JOBS.find(j => j.id === id);
		if (!job) {
			throw new Error("Training job not found");
		}
		return toApiResponse({ code: 200, message: "success", data: job });
	}));
}

/** 后端 queue 状态 (queued/running/completed/failed/cancelled) → 前端 TrainingStatus */
function _mapRunStatus(raw: string): TrainingStatus {
	const s = (raw || "pending").toLowerCase();
	if (s === "running")
		return "RUNNING";
	if (s === "completed")
		return "COMPLETED";
	if (s === "failed" || s === "cancelled")
		return "FAILED";
	return "PENDING";
}

// ===== 训练任务终止 (A4: 真实后端接入, 非 mock) =====
// 后端: POST /api/v1/tasks/{task_id}/cancel (SIGTERM 取消子进程)

/** 终止运行中的训练任务 (调用后端 cancel, 发送 SIGTERM) */
export async function cancelTrainingTask(taskId: string): Promise<{ task_id: string, status: string }> {
	const base = import.meta.env.VITE_LLM_FACTORY_BASE_URL || "";
	// P0-1: 鉴权统一走登录态 JWT (factoryAuthHeaders), 不再读 env 服务密钥
	const headers = factoryAuthHeaders();
	const resp = await fetch(`${base}/api/v1/tasks/${taskId}/cancel`, {
		method: "POST",
		headers,
	});
	if (!isSuccessResponse(resp.status)) {
		const body = await resp.json().catch(() => ({}));
		throw new Error(body.detail || `终止训练失败: ${resp.status}`);
	}
	return resp.json();
}
