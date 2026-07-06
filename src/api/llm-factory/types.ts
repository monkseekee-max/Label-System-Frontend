// ============================================================================
// Types
// ============================================================================

export type TriggerMode = "AUTO" | "SEMI_AUTO" | "MANUAL";
export type TrainingStatus = "RUNNING" | "COMPLETED" | "FAILED" | "OOM" | "PENDING";
export type TaskCategory = "TEXT_QA" | "IMAGE_CAPTION" | "IMAGE_QA" | "VIDEO_QA" | "VIDEO_CAPTION";
export type DatasetStatus = "READY" | "PENDING_REVIEW" | "FAILED";
export type PipelineSource = "API" | "UPLOAD" | "DVC";
export type PipelineStatus = "COMPLETED" | "PARTIAL_FAILED";
export type ModelType = "TEXT_BASE" | "MULTIMODAL";
export type PortType = "TEXT" | "MULTIMODAL";
export type GateResult = "PASS" | "WARN" | "FAIL";
export type EvalStatus = "PASS" | "FAIL";

// ============================================================
// Model Lifecycle / Alias / Context (ADR-019 P3-1/P3-3/P3-4)
// 对齐 src/compute/model_lifecycle.py 状态机与 src/app/lora/routes.py
// ============================================================

export type ModelLifecycleState = "training" | "staging" | "prod" | "superseded" | "archived" | "discarded" | "rejected";

export type ModelAliasName = "prod" | "canary" | "latest";

export type GateDecision = "pass" | "warn" | "fail";

export interface LifecycleOperation {
	action: string
	fromState: string | null
	toState: string | null
	actor: string | null
	reason: string | null
	gateDecision: string | null
	createdAt: string | null
}

export interface LifecycleStateResponse {
	version_tag?: string
	state: ModelLifecycleState
	company_id?: number
	model_family?: string
	[key: string]: unknown
}

export interface LifecycleDetailResponse {
	versionTag: string
	state: ModelLifecycleState
	operations: LifecycleOperation[]
}

export interface AliasSetResponse {
	versionTag: string
	company_id?: number
	model_family?: string
	alias?: string
	[key: string]: unknown
}

export interface CanaryRatioResponse {
	company_id?: number
	model_family?: string
	canaryRatio: number
	[key: string]: unknown
}

// 后端 rollback 响应保留 snake_case version_tag (与 setAlias 响应不同), 故显式标注
export interface AliasRollbackResponse {
	version_tag: string
	company_id?: number
	model_family?: string
	[key: string]: unknown
}

export interface ModelContextReport {
	modelTag: string
	lifecycle: {
		state: ModelLifecycleState
		companyId: number
		modelFamily: string
	}
	operations: LifecycleOperation[]
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

export interface TrainingJob {
	id: string // e.g., "task-018"
	runId: string // e.g., "run-20250611-001"
	triggerMode: TriggerMode
	baseModel: string // e.g., "Qwen3-8B"
	loraConfig: string // e.g., "Rank=16"
	dataSize: number
	status: TrainingStatus
	pipelineProgress: number // 0-100, number of completed steps out of 7
	gateResult: GateResult
	gateReason?: string // P3-2: 门禁决策原因 (后端 gate.reason)
	duration: number // minutes
	completedAt: string // ISO timestamp
}

export interface Dataset {
	id: number
	name: string
	taskCategory: TaskCategory
	sampleCount: number
	version: number // e.g., 3 for "v3"
	qualityScore: number // 0-100
	status: DatasetStatus
	updatedAt: string // ISO timestamp
}

export interface DataPipelineRun {
	id: string // e.g., "pipeline-001"
	source: PipelineSource
	recordCount: number
	status: PipelineStatus
	duration: number // minutes
	completedAt: string // ISO timestamp
}

export interface LoRAVersion {
	id: string // e.g., "lora_v20260610_001"
	tag: string
	baseModel: string
	path: string
	isActive: boolean
	createdAt: string // ISO timestamp
	lifecycle?: ModelLifecycleState
}

export interface Model {
	id: string
	name: string // e.g., "Qwen3-8B"
	repoPath: string
	type: ModelType
	params: string // e.g., "8B"
	diskSize: string // e.g., "~16GB"
	track: string // e.g., "unsloth_sft"
	inferencePort: number // e.g., 8001
	taskCategories: TaskCategory[]
	contextLength: number // e.g., 4096
	vramTotal: number // GB
	vramUsed: number // GB
	loraVersions: LoRAVersion[]
}

export interface InferencePort {
	port: number
	type: PortType
	status: "ONLINE" | "OFFLINE"
	requestsPerSecond: number
	p50Latency: number // ms
	vramUsed: number // GB
	vramTotal: number // GB
	loraAdapters: Array<{
		id: string
		name: string
		isActive: boolean
		requestRate: number // req/s
	}>
}

export interface EvalJob {
	id: string // e.g., "eval-001"
	loraVersion: string
	model: string
	benchmark: string
	compareVersion?: string
	scores: {
		metric1: number
		metric2: number
		metric3: number
		metric4: number
	}
	gateResult: GateResult
	duration: number // minutes
	completedAt: string // ISO timestamp
}

export interface Benchmark {
	id: number
	name: string
	sampleCount: number
	taskCategory: TaskCategory
	createdAt: string // ISO timestamp
	filePath: string
	benchmarkId?: string
}

export interface PageResult<T> {
	records: T[]
	total: number
	pageNo: number
	pageSize: number
}

export interface MediaAsset {
	id: string
	mediaId: string // e.g., "image_1718012345_3a7f"
	type: "image" | "video"
	fileSize: number // bytes
	mimeType: string
	width?: number
	height?: number
	duration?: number // seconds for video
	taskCategory: TaskCategory
	sha256: string
	uploadedAt: string // ISO timestamp
	filePath: string
}

export interface TaskType {
	id: string
	code: TaskCategory | "TEXT_ONLY"
	name: string
	subtitle: string
	modality: "text" | "image" | "video"
	recommendedModel: string
	trainingTrack: string
	labelTemplate: string
	inferencePort: number
	dataFormat: string
}

// Training Jobs

export interface TrainingJobListParams {
	keyword?: string
	status?: TrainingStatus
	triggerMode?: TriggerMode
	pageNo?: number
	pageSize?: number
}

// Datasets

export interface DatasetListParams {
	keyword?: string
	taskCategory?: TaskCategory
	status?: DatasetStatus
	pageNo?: number
	pageSize?: number
}

// Data Pipeline

export interface PipelineRunListParams {
	source?: PipelineSource
	status?: PipelineStatus
	pageNo?: number
	pageSize?: number
}

// Evaluation

export interface EvalJobListParams {
	loraVersion?: string
	benchmark?: string
	gateResult?: GateResult
	pageNo?: number
	pageSize?: number
}

// Media Assets

export interface MediaAssetListParams {
	type?: "image" | "video"
	taskCategory?: TaskCategory
	keyword?: string
	pageNo?: number
	pageSize?: number
}

// ============================================================
// Feedback 回流 (ADR-019 P3-5)
// 操作性 API (mutating/state-query), 禁 mock fallback, 失败抛错.
// ============================================================

export type FeedbackSource = "low_confidence" | "user_correction" | "eval_failure";

export interface FeedbackSample {
	sample_id: string
	source: string
	content: string
	model_tag: string
	company_id: number
	confidence: number | null
	status: string
	created_at: string | null
}
