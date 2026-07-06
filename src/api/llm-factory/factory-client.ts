/**
 * 训练工厂规范接口真实后端客户端 (接口规范第12-20章)
 *
 * 对接 /api/v1/factory/* 真实端点, 替代 index.ts 的 mock 数据。
 * 设计:
 * - 统一信封 {code, message, data} 适配为前端 ApiResponse
 * - 字段映射: 后端 camelCase 规范契约 → 前端既有类型 (Dataset/Model/EvalJob 等)
 * - 鉴权: Bearer JWT (登录态, 多租户安全边界)
 * - 失败回退: 调用方可选 fallback 到 mock, 保证前端页面不白屏
 */

import { isSuccessResponse } from "#src/api/shared";
import { useUserStore } from "#src/store/user";

import { factoryAuthHeaders } from "./factory-auth";

// 从 env 读取配置 (运行时可覆盖, 不固化模块顶层 const)
// 默认 "" → 同源相对路径 (/api/v1/...), dev 由 vite proxy 转 9090, 生产由反向代理转后端
function getBase(): string {
	return import.meta.env.VITE_LLM_FACTORY_BASE_URL || "";
}

/**
 * 鉴权 header: 统一使用登录用户 JWT (factoryAuthHeaders).
 *
 * P0-1 安全修正: 不再回退 X-API-Key (env 服务密钥会进浏览器 bundle 被提取).
 * 本模块仅在被 AuthGuard 守护的页面调用, 登录态 JWT 必然存在.
 */
function authHeaders(): Record<string, string> {
	return factoryAuthHeaders({ "Content-Type": "application/json" });
}

/**
 * companyId: 从登录用户信息取 (useUserStore, /auth/me 填充), 缺省 1
 *
 * 注意: 普通用户的 companyId 最终由后端 require_tenant 强制从 token 取,
 * 此处仅用于 admin 跨租户场景或前端展示.
 */
function getCompanyId(): number {
	const cid = useUserStore.getState().companyId;
	if (typeof cid === "number" && cid > 0)
		return cid;
	const raw = import.meta.env.VITE_COMPANY_ID;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

/** 后端信封 */
interface Envelope<T> {
	code: number
	message: string
	data: T
}

/** 统一请求: 返回 data 部分, 非 200 抛错 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const resp = await fetch(`${getBase()}${path}`, {
		...init,
		headers: { ...authHeaders(), ...(init?.headers || {}) },
	});
	let body: Envelope<T>;
	try {
		body = await resp.json();
	}
	catch {
		throw new Error(`接口响应解析失败: ${resp.status} ${path}`);
	}
	if (!isSuccessResponse(resp.status) || !isSuccessResponse(body.code)) {
		throw new Error(body.message || `请求失败: ${resp.status}`);
	}
	return body.data;
}

/**
 * 原始请求 (无信封): 旧端点 /api/v1/media, /api/v1/tasks/{id} 直接返回 body, 无 {code,message,data} 信封.
 *  这些端点不走 factory 的 ok() 信封, 若用 request() 会因 body.code===undefined 抛错.
 */
async function requestRaw<T>(path: string, init?: RequestInit): Promise<T> {
	const resp = await fetch(`${getBase()}${path}`, {
		...init,
		headers: { ...authHeaders(), ...(init?.headers || {}) },
	});
	if (!isSuccessResponse(resp.status)) {
		let msg = `请求失败: ${resp.status}`;
		try { const e = await resp.json(); msg = e.detail || e.message || msg; } catch { /* noop */ }
		throw new Error(msg);
	}
	return resp.json();
}

export async function uploadMediaAsset(file: File, mediaType: string, taskType: string) {
	const form = new FormData();
	form.append("file", file);
	const resp = await fetch(`${getBase()}/api/v1/media/upload?media_type=${mediaType}&task_type=${taskType}`, {
		method: "POST",
		headers: { ...authHeaders() },
		body: form,
	});
	if (!isSuccessResponse(resp.status)) {
		let msg = `上传失败: ${resp.status}`;
		try { const e = await resp.json(); msg = e.detail || e.error || msg; } catch { /* noop */ }
		throw new Error(msg);
	}
	return resp.json();
}

/** GET 拼接 query */
function withQuery(base: string, params: Record<string, unknown>): string {
	const qs = Object.entries(params)
		.filter(([, v]) => v !== undefined && v !== null && v !== "")
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
		.join("&");
	return qs ? `${base}?${qs}` : base;
}

// ============================================================
// 后端规范契约类型 (camelCase, 与 src/app/factory/service.py 对齐)
// ============================================================

export interface FactoryTask {
	runId: string
	taskType: string
	triggerMode: string
	modelName: string
	completedAt: string | null
	duration: number
	loraRank: string
	status: string
	gate: string
	pipelineProgress: { stepsCompleted: number, stepsTotal: number }
}

export interface FactoryDatasetRecord {
	datasetId: string
	setName: string
	trainingTaskType: string
	sampleCount: number
	version: string
	status: string
	updateTime: string
}

export interface FactoryDatasetOverview {
	datasetCount: number
	totalSamples: number
	versionCount: number
	avgQualityScore: number
}

export interface FactoryModel {
	modelName: string
	modelPath: string
	parameterSize: string
	trainingTrack: string
	taskTypes: string[]
	diskSize: string
	inferencePort: number
	contextLength: number
	loraVersions: { versionTag: string, loraPath: string, isActive: boolean, createdAt: string }[]
}

export interface FactoryLoraVersions {
	models: FactoryModel[]
	operationLogs: {
		operation: string
		versionTag: string
		baseModelName: string
		operationTime: string
		status: string
	}[]
}

export interface FactoryEvalResult {
	jobId: string
	loraVersion: string
	modelName: string
	benchmarkId: string
	status: string
	scores: Record<string, unknown>
	gateDecision: string
	gateReason: string | null
	testSamples: number
	duration: number
	durationSeconds: number
	model1: string
	vllmBaseUrl: string | null
	completedAt: string
}

export interface FactoryEvalRunResult {
	jobId: string
	status: string
	loraVersion: string
	benchmarkId: string | null
	model1: string
	vllmBaseUrl: string | null
	pollUrl: string
}

export interface FactoryBenchmarkSample {
	id?: string
	type?: string
	input?: Record<string, unknown>
	expected?: Record<string, unknown>
	[key: string]: unknown
}

export interface FactoryBenchmarkDetail extends FactoryBenchmark {
	isLocked: boolean
	samples: FactoryBenchmarkSample[]
}

export interface FactoryBenchmark {
	benchmarkId: string
	name: string
	description: string
	benchmarkType: string
	sampleCount: number
	filePath: string
	datasetId: string
	createdAt: string
}

export interface FactoryTaskType {
	recommendedModel: string
	trainingTrack: string
	annotationTemplate: string
	inferencePort: number
	dataFormat: string
}

export interface FactoryTaskTypes {
	taskTypes: FactoryTaskType[]
	strategyRoutes: {
		taskCategory: string
		taskType: string
		recommendedModel: string
		trainingTrack: string
		inferencePort: number
		converter: string
		metrics: string
	}[]
}

export interface FactoryOverview {
	apiCallCount: number
	runningTaskCount: number
	pendingExpertReviewCount: number
	loraVersionCount: number
	serviceAvailabilityRate: number
	evaluationPassRate: number
	datasetCount: number
	flywheelSpeed: number
	gpuUsedCount: number
	gpuTotalCount: number
	vllmTextPort: number
	vllmMmPort: number
}

export interface FactoryGpu {
	name: string
	status: string
	memoryUtilization: string
	totalMemory: string
	usedMemory: string
	temperature: string
	cpuUtilization: string
}

export interface FactoryGpuAlarm {
	alarmId: string
	alarmLevel: string
	alarmContent: string
	alarmTime: string
	gpuName: string
}

export interface FactorySchedulerOverview {
	mode: string
	statistics: { labelThresholds: number, currentLabels: number }
}

/** /api/v1/media 列表项 (扩展元数据, 非 mock) */
export interface FactoryMediaItem {
	media_id: string
	media_type: string
	file_path: string
	file_size: number | null
	task_type: string | null
	mime_type: string | null
	width: number | null
	height: number | null
	duration: number | null
	checksum_sha256: string | null
	created_at: string | null
}

/** /api/v1/factory/data/batches 批次项 (DataBatch 运行视角) */
export interface FactoryDataBatch {
	batchId: string
	source: string
	recordCount: number
	imported: number
	duplicates: number
	errors: number
	status: string
	createdAt: string | null
}

/** /api/v1/tasks/{id} 运行态任务详情 (task_queue.to_dict) */
export interface FactoryTaskStatus {
	task_id: string
	task_type: string
	trigger_mode: string
	status: string
	started_at: string | null
	completed_at: string | null
	duration_seconds: number | null
	exit_code: number | null
	error: string | null
	log_lines: number
	pipeline_progress: { stage: string, steps_completed: number, steps_total: number }
	gate: { passed: boolean | null, reason: string }
	metadata: Record<string, unknown>
}

// ============================================================
// Lifecycle / Alias / Context 类型 (ADR-019 P3-1/P3-3/P3-4)
// 对齐 src/app/lora/routes.py + src/compute/model_lifecycle.py 状态机
// ============================================================

/** 模型 lifecycle 状态 (与后端 ModelLifecycle 枚举对齐) */
export type FactoryModelLifecycleState = "training" | "staging" | "prod" | "superseded" | "archived" | "discarded" | "rejected";

/** alias 名 (受后端约束: prod/canary/latest) */
export type FactoryModelAliasName = "prod" | "canary" | "latest";

/** 评测门禁决策 (staging→prod 必须为 'pass') */
export type FactoryGateDecision = "pass" | "warn" | "fail";

/** POST /versions/{tag}/register 请求体 */
export interface FactoryLifecycleRegisterRequest {
	company_id: number
	model_family: string
	state?: string
}

/** POST /versions/{tag}/promote 请求体 */
export interface FactoryLifecyclePromoteRequest {
	gate_decision: string
	company_id?: number
	actor?: string
}

/** POST /versions/{tag}/archive | /discard 请求体 */
export interface FactoryLifecycleReasonRequest {
	actor?: string
	reason?: string
}

/** PUT /aliases/{alias} 请求体 */
export interface FactoryAliasSetRequest {
	company_id: number
	model_family: string
	version_tag: string
}

/** PUT /aliases/canary/ratio 请求体 */
export interface FactoryCanaryRatioRequest {
	company_id: number
	model_family: string
	ratio: number
}

/** POST /aliases/rollback 请求体 */
export interface FactoryAliasRollbackRequest {
	company_id: number
	model_family: string
	actor?: string
	reason?: string
}

/** lifecycle 操作日志条目 (GET /lifecycle.operations 与 GET /context.operations 共用) */
export interface FactoryLifecycleOperation {
	action: string
	fromState: string | null
	toState: string | null
	actor: string | null
	reason: string | null
	gateDecision: string | null
	createdAt: string | null
}

/** 通用 lifecycle state 响应 (register/promote/archive/discard 共用, 字段可能部分缺失) */
export interface FactoryLifecycleStateResponse {
	version_tag?: string
	state: FactoryModelLifecycleState
	company_id?: number
	model_family?: string
	[key: string]: unknown
}

/** GET /versions/{tag}/lifecycle 响应 */
export interface FactoryLifecycleDetailResponse {
	versionTag: string
	state: FactoryModelLifecycleState
	operations: FactoryLifecycleOperation[]
}

/** PUT /aliases/{alias} 响应 */
export interface FactoryAliasSetResponse {
	versionTag: string
	company_id?: number
	model_family?: string
	alias?: string
	[key: string]: unknown
}

/** PUT /aliases/canary/ratio 响应 */
export interface FactoryCanaryRatioResponse {
	company_id?: number
	model_family?: string
	canaryRatio: number
	[key: string]: unknown
}

/** POST /aliases/rollback 响应 (注意: 后端用 snake_case version_tag) */
export interface FactoryAliasRollbackResponse {
	version_tag: string
	company_id?: number
	model_family?: string
	[key: string]: unknown
}

/** GET /versions/{tag}/context 响应 (ModelContextTraceback.trace 输出, lineage/eval 可选) */
export interface FactoryModelContextReport {
	modelTag: string
	lifecycle: {
		state: FactoryModelLifecycleState
		companyId: number
		modelFamily: string
	}
	operations: FactoryLifecycleOperation[]
	lineage?: {
		training_run_id: string
		dataset_version_tag: string
		dataset_fingerprint: string
		annotation_count: number
		storage_key: string | null
	}
	eval?: {
		scores: Record<string, unknown>
		gate_decision: string | null
		gate_reason: string | null
		evaluated_at: string | null
		storage_key: string | null
	}
}

// ============================================================
// Feedback 回流 (ADR-019 P3-5, /api/v1/feedback/*)
// 对齐 src/app/feedback/routes.py
// ============================================================

export type FactoryFeedbackSource = "low_confidence" | "user_correction" | "eval_failure";

/** POST /feedback/ingest 请求体 */
export interface FactoryFeedbackIngestRequest {
	source: string
	content: string
	model_tag: string
	company_id: number
	confidence?: number
}

/** POST /feedback/generate-tasks 请求体 */
export interface FactoryFeedbackGenerateTasksRequest {
	company_id: number
	project_id: number
	max_count?: number
}

/** GET /feedback/pending 列表项 / ingest 响应 */
export interface FactoryFeedbackSample {
	sample_id: string
	source: string
	content: string
	model_tag: string
	company_id: number
	confidence: number | null
	status: string
	created_at: string | null
}

// ============================================================
// API 函数 (对应 src/app/factory/routes.py)
// ============================================================

export const factoryApi = {
	// Ch12
	getOverview: () => request<FactoryOverview>("/api/v1/factory/overview"),
	getOpsBoard: (companyId?: number) =>
		request<unknown>(withQuery("/api/v1/factory/ops-board", { companyId: companyId ?? getCompanyId() })),

	// Ch13
	getTaskTypes: () => request<FactoryTaskTypes>("/api/v1/factory/task-types"),

	// Ch14
	getLoraVersions: (companyId?: number) =>
		request<FactoryLoraVersions>(withQuery("/api/v1/factory/lora/versions", { companyId: companyId ?? getCompanyId() })),

	// Ch15
	getTasks: (companyId?: number, status?: string, limit = 20, offset = 0) =>
		request<{ tasks: FactoryTask[], total: number }>(
			withQuery("/api/v1/factory/tasks", { companyId: companyId ?? getCompanyId(), status, limit, offset }),
		),

	// Ch16
	getEvalResults: (companyId?: number, loraVersion?: string, benchmarkId?: string, jobId?: string, limit = 20, offset = 0) =>
		request<{ records: FactoryEvalResult[], total: number, pageNo: number, pageSize: number }>(
			withQuery("/api/v1/factory/eval/results", {
				companyId: companyId ?? getCompanyId(),
				lora_version: loraVersion,
				benchmarkId,
				job_id: jobId,
				limit,
				offset,
			}),
		),
	getBenchmarks: (companyId?: number) =>
		request<{ benchmarks: FactoryBenchmark[] }>(
			withQuery("/api/v1/factory/eval/benchmarks", { companyId: companyId ?? getCompanyId() }),
		),
	getBenchmarkDetail: (benchmarkId: string) =>
		requestRaw<FactoryBenchmarkDetail>(`/api/v1/factory/eval/benchmarks/${encodeURIComponent(benchmarkId)}`),
	createBenchmark: (payload: { name: string, description?: string, benchmarkId?: string, samples?: FactoryBenchmarkSample[] }) =>
		requestRaw<{ benchmarkId: string, name: string, sampleCount: number, filePath: string }>(
			"/api/v1/factory/eval/benchmark",
			{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
				name: payload.name,
				description: payload.description || "",
				benchmarkId: payload.benchmarkId,
				samples: payload.samples || [],
			}) },
		),
	runEval: (payload: { loraVersion: string, benchmarkId?: string, compareWith?: string, runRegression?: boolean, model1?: string, vllmBaseUrl?: string }) =>
		requestRaw<FactoryEvalRunResult>(
			"/api/v1/factory/eval/run",
			{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
				loraVersion: payload.loraVersion,
				benchmarkId: payload.benchmarkId,
				compareWith: payload.compareWith,
				runRegression: payload.runRegression ?? false,
				model1: payload.model1,
				vllmBaseUrl: payload.vllmBaseUrl,
			}) },
		),
	getEvalJob: (jobId: string) =>
		requestRaw<FactoryEvalResult>(`/api/v1/factory/eval/results/${encodeURIComponent(jobId)}`),

	// Ch18
	getDatasets: (companyId?: number, status?: string, limit = 20, offset = 0) =>
		request<{ records: FactoryDatasetRecord[], total: number }>(
			withQuery("/api/v1/factory/datasets", { companyId: companyId ?? getCompanyId(), status, limit, offset }),
		),
	getDatasetsOverview: (companyId?: number) =>
		request<FactoryDatasetOverview>(
			withQuery("/api/v1/factory/datasets/overview", { companyId: companyId ?? getCompanyId() }),
		),

	// Ch19
	getSchedulerMode: (companyId?: number) =>
		request<FactorySchedulerOverview>(
			withQuery("/api/v1/factory/scheduler/mode", { companyId: companyId ?? getCompanyId() }),
		),
	setSchedulerMode: (companyId: number, mode: string) =>
		request<{ mode: string }>("/api/v1/factory/scheduler/mode", {
			method: "PUT",
			body: JSON.stringify({ companyId, mode }),
		}),

	// Ch20
	getGpuList: () => request<{ gpuList: FactoryGpu[] }>("/api/v1/factory/gpu/list"),
	getGpuAlarms: (limit = 50) =>
		request<{ alarms: FactoryGpuAlarm[] }>(withQuery("/api/v1/factory/gpu/alarms", { limit })),

	// 数据管道批次 (Ch-pipeline, 前端 pipeline 页面数据源)
	getDataBatches: (companyId?: number, source?: string, status?: string, limit = 20, offset = 0) =>
		request<{ records: FactoryDataBatch[], total: number }>(
			withQuery("/api/v1/factory/data/batches", { companyId: companyId ?? getCompanyId(), source, status, limit, offset }),
		),

	// 运行态任务详情 (非 factory 前缀; queue.to_dict, 含 status/progress/gate)
	// 注: /api/v1/tasks/{id} 不返回信封, 用 requestRaw
	getTaskStatus: (taskId: string) =>
		requestRaw<FactoryTaskStatus>(`/api/v1/tasks/${encodeURIComponent(taskId)}`),

	// 媒体资源 (非 factory 前缀; 列表含完整元数据字段)
	// 注: /api/v1/media 不返回信封, 用 requestRaw
	getMedia: (mediaType?: string, taskType?: string, limit = 20, offset = 0) =>
		requestRaw<{ total: number, items: FactoryMediaItem[] }>(
			withQuery("/api/v1/media", { media_type: mediaType, task_type: taskType, limit, offset }),
		),

	// ============================================================
	// Lifecycle / Alias / Context (ADR-019 P3-1/P3-3/P3-4, /api/v1/lora/*)
	// ============================================================

	registerVersion: (versionTag: string, companyId: number, modelFamily: string, state?: string) =>
		request<FactoryLifecycleStateResponse>(
			`/api/v1/lora/versions/${encodeURIComponent(versionTag)}/register`,
			{
				method: "POST",
				body: JSON.stringify({
					company_id: companyId,
					model_family: modelFamily,
					state,
				} as FactoryLifecycleRegisterRequest),
			},
		),

	getLifecycle: (versionTag: string) =>
		request<FactoryLifecycleDetailResponse>(
			`/api/v1/lora/versions/${encodeURIComponent(versionTag)}/lifecycle`,
		),

	promoteToProd: (versionTag: string, gateDecision: string, companyId?: number, actor?: string) =>
		request<FactoryLifecycleStateResponse>(
			`/api/v1/lora/versions/${encodeURIComponent(versionTag)}/promote`,
			{
				method: "POST",
				body: JSON.stringify({
					gate_decision: gateDecision,
					company_id: companyId,
					actor,
				} as FactoryLifecyclePromoteRequest),
			},
		),

	archiveVersion: (versionTag: string, actor?: string, reason?: string) =>
		request<FactoryLifecycleStateResponse>(
			`/api/v1/lora/versions/${encodeURIComponent(versionTag)}/archive`,
			{
				method: "POST",
				body: JSON.stringify({ actor, reason } as FactoryLifecycleReasonRequest),
			},
		),

	discardVersion: (versionTag: string, actor?: string, reason?: string) =>
		request<FactoryLifecycleStateResponse>(
			`/api/v1/lora/versions/${encodeURIComponent(versionTag)}/discard`,
			{
				method: "POST",
				body: JSON.stringify({ actor, reason } as FactoryLifecycleReasonRequest),
			},
		),

	setAlias: (alias: string, companyId: number, modelFamily: string, versionTag: string) =>
		request<FactoryAliasSetResponse>(
			`/api/v1/lora/aliases/${encodeURIComponent(alias)}`,
			{
				method: "PUT",
				body: JSON.stringify({
					company_id: companyId,
					model_family: modelFamily,
					version_tag: versionTag,
				} as FactoryAliasSetRequest),
			},
		),

	getAlias: (companyId: number, modelFamily: string, alias: string) =>
		request<string>(
			withQuery("/api/v1/lora/aliases", {
				company_id: companyId,
				model_family: modelFamily,
				alias,
			}),
		),

	setCanaryRatio: (companyId: number, modelFamily: string, ratio: number) =>
		request<FactoryCanaryRatioResponse>("/api/v1/lora/aliases/canary/ratio", {
			method: "PUT",
			body: JSON.stringify({
				company_id: companyId,
				model_family: modelFamily,
				ratio,
			} as FactoryCanaryRatioRequest),
		}),

	rollbackAlias: (companyId: number, modelFamily: string, actor?: string, reason?: string) =>
		request<FactoryAliasRollbackResponse>("/api/v1/lora/aliases/rollback", {
			method: "POST",
			body: JSON.stringify({
				company_id: companyId,
				model_family: modelFamily,
				actor,
				reason,
			} as FactoryAliasRollbackRequest),
		}),

	getModelContext: (versionTag: string) =>
		request<FactoryModelContextReport>(
			`/api/v1/lora/versions/${encodeURIComponent(versionTag)}/context`,
		),

	// ============================================================
	// Feedback 回流 (ADR-019 P3-5, /api/v1/feedback/*)
	// ============================================================

	ingestFeedback: (source: string, content: string, modelTag: string, companyId: number, confidence?: number) =>
		request<FactoryFeedbackSample>("/api/v1/feedback/ingest", {
			method: "POST",
			body: JSON.stringify({
				source,
				content,
				model_tag: modelTag,
				company_id: companyId,
				confidence,
			} as FactoryFeedbackIngestRequest),
		}),

	listPendingFeedback: (companyId: number) =>
		request<FactoryFeedbackSample[]>(
			withQuery("/api/v1/feedback/pending", { company_id: companyId }),
		),

	generateFeedbackTasks: (companyId: number, projectId: number, maxCount = 50) =>
		request<unknown>("/api/v1/feedback/generate-tasks", {
			method: "POST",
			body: JSON.stringify({
				company_id: companyId,
				project_id: projectId,
				max_count: maxCount,
			} as FactoryFeedbackGenerateTasksRequest),
		}),
};
