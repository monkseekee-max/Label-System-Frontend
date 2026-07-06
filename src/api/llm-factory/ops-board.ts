import { request } from "#src/utils/request";

// ============================================================
// 运营看板真实数据源 (全部接真实后端, 无硬编码).
// 端点: /api/v1/system/gpu, /api/v1/metrics/dashboard, /api/v1/system/health
// ============================================================

/** 单块 GPU 实时指标 (与 gpu-monitor 页同源, GET /api/v1/system/gpu). */
export interface GpuMetric {
	id: string
	name: string
	utilization: number
	utilizationDisplay: string
	vramUsed: number
	vramTotal: number
	temperature: number
	power: number
	status: "busy" | "active" | "idle"
	task?: string
}

export interface GpuStatusResponse {
	gpus: GpuMetric[]
	available: boolean
}

/** 训练看板汇总 (GET /api/v1/metrics/dashboard, 真实). */
export interface TrainingDashboard {
	total_data: number
	total_trainings: number
	active_lora: string | null
	flywheel: {
		annotations: number
		trainings: number
		models: number
		eval_pass_rate: number
		pending_review: number
	}
	summary: {
		total_trainings: number
		avg_loss: number
		avg_duration_seconds: number
		avg_peak_vram_gb: number
	}
	recent_pipeline: Array<{
		run_id: string
		status: string
		model_key: string
		final_loss: number | null
	}>
	infra: {
		vllm_text_port: number
		vllm_mm_port: number
	}
}

/** 服务健康检查项 (GET /api/v1/system/health, 真实探活结果). */
export interface ServiceHealthItem {
	name: string
	healthy: boolean
	port?: number
	detail?: string
}

export interface ServiceHealthResponse {
	services: ServiceHealthItem[]
}

/** vLLM 单实例状态 (GET /api/v1/system/info → vllm.text/multimodal, 真实). */
export interface VllmInstanceStatus {
	running: boolean
	port: number
	pids: number[]
	models: string[]
}

/** 系统总览 (GET /api/v1/system/info, 真实: GPU/vLLM/lora/tasks/eval/data). */
export interface SystemInfo {
	version: string
	deployment_mode: string
	gpu: { device?: string, vram_total_gb?: number, vram_used_gb?: number, available?: boolean }
	vllm: { text: VllmInstanceStatus, multimodal: VllmInstanceStatus }
	data: { total_annotations: number }
	lora: { active: string | null, total_versions: number }
	eval: { total_completed: number }
	tasks: { running: number, details: Array<Record<string, unknown>> }
}

/** 读取 GPU 实时指标. */
export function fetchGpuStatus() {
	return request.get("v1/system/gpu").json<GpuStatusResponse>();
}

/** 读取训练看板汇总 (真实). */
export function fetchTrainingDashboard() {
	// metrics/dashboard 返回裸对象 (无 {code,message,data} 信封)
	return request.get("v1/metrics/dashboard").json<TrainingDashboard>();
}

/** 读取服务健康状态 (真实探活). */
export function fetchServiceHealth() {
	return request.get("v1/system/health").json<ServiceHealthResponse>();
}

/** 读取系统总览 (真实: vLLM 运行状态/lora/tasks/GPU/eval). vLLM 探活内置 5s 超时, 两个实例都宕时约 10s. */
export function fetchSystemInfo() {
	return request.get("v1/system/info").json<SystemInfo>();
}
