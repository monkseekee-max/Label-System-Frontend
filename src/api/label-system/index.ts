// ============================================================================
// label-system 智能标注 API 适配层 (ADR-013 方案A 阶段三)
// 通过 BFF 代理 (/api/data /api/ai /api/workflows) 访问源微服务真实业务
// 源服务返回裸数据 (非 {code,message,data} 信封), 此处直接透传
// ============================================================================

import { useAuthStore } from "#src/store/auth";
import { request } from "#src/utils/request";

// ============================================================================
// Types — 资产/数据飞轮
// ============================================================================

export interface DataAsset {
	id: string
	name: string
	data_type: string // text | image | video
	source: string
	normalized_markdown?: string
	tags: string[]
	status: string // ready | processing
	current_version: number
	metadata?: Record<string, unknown>
	/** 是否已同步到知识库 (向量检索), 后端持久化, 刷新不丢失 */
	knowledge_base_synced?: boolean
	created_at?: string
	updated_at?: string
}

export interface AssetListResponse {
	items: DataAsset[]
	total: number
}

export interface QAItem {
	id: string
	asset_id: string
	question: string
	answer: string
	evidence?: string | null
	reasoning?: string | null
	confidence: number
	score_bucket: "green" | "orange" | "red"
	candidate_models: string[]
	final_model?: string | null
	status: string
	modality: string
	source_type: string
	requires_human_review: boolean
	is_training_eligible: boolean
	created_at?: string
	votes?: Array<{ model_alias: string, answer: string, evidence?: string }>
}

export interface QARunResponse {
	id: string
	asset_id: string
	status: string
	generated_count: number
	green_count: number
	orange_count: number
	red_count: number
	items: QAItem[]
	failed_models?: string[]
}

// ============================================================================
// API 函数
// ============================================================================

const AUTH_HEADER = "Authorization";

function authHeaders(): Record<string, string> {
	const token = useAuthStore.getState().token || "";
	if (!token) {
		throw new Error("未认证: 缺少登录 token");
	}
	return { [AUTH_HEADER]: `Bearer ${token}` };
}

/** 资产列表 */
export function fetchAssets() {
	return request.get("data/assets", { headers: authHeaders() }).json<AssetListResponse>();
}

/** 上传资产 (MarkItDown 全格式转 Markdown) */
export function uploadAsset(file: File, name?: string) {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("name", name || file.name);
	return request
		.post("data/assets/upload", {
			body: formData,
			headers: authHeaders(),
			// ky 对 FormData 不要手动设置 content-type
		})
		.json<DataAsset>();
}

/** 删除资产 */
export function deleteAsset(id: string) {
	return request.delete(`data/assets/${id}`, { headers: authHeaders() }).json<unknown>();
}

/** 持久化资产的知识库同步状态 (避免前端刷新丢失 "已入库" 标记) */
export function markKnowledgeSynced(assetId: string, synced: boolean) {
	return request.post(`data/assets/${assetId}/knowledge-sync`, {
		json: { synced },
		headers: authHeaders(),
	}).json<DataAsset>();
}

/** 生成 QA (多模型 + 置信度分桶) */
export function generateQA(params: {
	asset_id: string
	modality?: string
	candidate_models?: string[]
	item_count?: number
}) {
	return request
		.post("ai/qa-runs", {
			json: {
				modality: "text",
				candidate_models: ["qwen3-8b"],
				item_count: 3,
				...params,
			},
			headers: authHeaders(),
			timeout: 120000,
		})
		.json<QARunResponse>();
}

/** 提交审核 (green 免盲标 / orange 复核 / red 必须标注) */
export function submitQAItem(qaItemId: string, approved: boolean, comment?: string) {
	return request
		.post(`workflows/qa-items/${qaItemId}/submit`, {
			json: { action: approved ? "approve" : "reject", comment },
			headers: authHeaders(),
		})
		.json<unknown>();
}

/** 平台总览 */
export function fetchPlatformOverview() {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return request.get("label/stats", { headers: authHeaders() }).json<any>();
}

// ============================================================================
// 资产详情/原始内容/标注 (补全对照源 services/api.js)
// ============================================================================

export function fetchAsset(id: string) {
	return request.get(`data/assets/${id}`, { headers: authHeaders() }).json<DataAsset>();
}

export function fetchAssetRaw(id: string) {
	return request.get(`data/assets/${id}/raw`, { headers: authHeaders() }).blob();
}

export function updateAsset(id: string, payload: Partial<DataAsset>) {
	return request.patch(`data/assets/${id}`, { json: payload, headers: authHeaders() }).json<DataAsset>();
}

export interface AssetAnnotation {
	id: string
	asset_id: string
	content: string
	modality: string
	created_at?: string
}

export function listAnnotations(assetId: string) {
	return request.get(`data/assets/${assetId}/annotations`, { headers: authHeaders() }).json<{ items: AssetAnnotation[] }>();
}

export function createAnnotation(assetId: string, payload: Partial<AssetAnnotation>) {
	return request.post(`data/assets/${assetId}/annotations`, { json: payload, headers: authHeaders() }).json<AssetAnnotation>();
}

export function updateAnnotation(annotationId: string, payload: Partial<AssetAnnotation>) {
	return request.patch(`data/annotations/${annotationId}`, { json: payload, headers: authHeaders() }).json<AssetAnnotation>();
}

// ============================================================================
// QA 列表/详情/编辑/定稿 (补全)
// ============================================================================

export function listQAItems(params?: { status?: string, modality?: string, asset_id?: string, page?: number, page_size?: number }) {
	return request.get("ai/qa-items", { searchParams: params as any, headers: authHeaders() }).json<{ items: QAItem[], total: number }>();
}

export function listQAByAsset(assetId: string) {
	return request.get(`ai/assets/${assetId}/qa-items`, { headers: authHeaders() }).json<{ items: QAItem[] }>();
}

export function fetchQAItem(qaItemId: string) {
	return request.get(`ai/qa-items/${qaItemId}`, { headers: authHeaders() }).json<QAItem>();
}

export function updateQAItem(qaItemId: string, payload: Partial<QAItem>) {
	return request.patch(`ai/qa-items/${qaItemId}`, { json: payload, headers: authHeaders() }).json<QAItem>();
}

export function finalizeDetailQA(payload: { qa_item_id: string, final_model?: string }) {
	return request.post("ai/detail-qa-items", { json: payload, headers: authHeaders(), timeout: 120000 }).json<QAItem>();
}

// ★ 将多模态分析结果(区域/帧)落库为 QAItem — 打通图片/视频标注闭环 (P1#2)
export interface DetailFinalizePayload {
	detail_type: "image_region" | "video_frame" | "video_window"
	asset_id: string
	region_label?: string
	timestamp?: number | null
	start_timestamp?: number | null
	end_timestamp?: number | null
	question: string
	answer: string
	evidence?: string | null
	reasoning?: string | null
	score: number
	score_bucket: string
	candidate_models: string[]
	final_model?: string | null
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	votes?: Array<any>
	frames?: Array<{ timestamp?: number | null, question?: string | null, answer?: string | null, evidence?: string | null, reasoning?: string | null }>
	auto_submit?: boolean
}
export function finalizeDetailAnalysis(payload: DetailFinalizePayload) {
	return request.post("ai/detail-qa-items", { json: payload, headers: authHeaders(), timeout: 120000 }).json<{ created: boolean, qa_item: { id: string, status: string, score_bucket: string, modality: string }, workflow?: unknown }>();
}

export function finalizeVideoWindowQA(payload: Record<string, unknown>) {
	return request.post("ai/video-window-qa-items", { json: payload, headers: authHeaders(), timeout: 180000 }).json<unknown>();
}

// ============================================================================
// 工作流审核 (补全)
// ============================================================================

export interface WorkflowHistoryEntry {
	id: string
	asset_id?: string
	qa_item_id?: string
	action: string
	status: string
	reviewer?: string
	comment?: string | null
	created_at?: string
}

export function submitAssetWorkflow(assetId: string) {
	return request.post(`workflows/assets/${assetId}/submit`, { headers: authHeaders() }).json<unknown>();
}

export function reviewAssetWorkflow(assetId: string, payload: { approved: boolean, comment?: string }) {
	return request.post(`workflows/assets/${assetId}/review`, { json: payload, headers: authHeaders() }).json<unknown>();
}

export function assetWorkflowHistory(assetId: string) {
	return request.get(`workflows/assets/${assetId}/history`, { headers: authHeaders() }).json<{ items: WorkflowHistoryEntry[] }>();
}

export function reviewQAItemWorkflow(qaItemId: string, payload: { approved: boolean, comment?: string }) {
	return request.post(`workflows/qa-items/${qaItemId}/review`, { json: payload, headers: authHeaders() }).json<unknown>();
}

export function qaItemWorkflowHistory(qaItemId: string) {
	return request.get(`workflows/qa-items/${qaItemId}/history`, { headers: authHeaders() }).json<{ items: WorkflowHistoryEntry[] }>();
}

// ============================================================================
// 训练管线 (补全 — TrainingPipeline/ModelHub 页)
// ============================================================================

export interface TrainingDataset {
	id: string
	name: string
	item_count: number
	status: string
	created_at?: string
}

export interface TrainingJob {
	id: string
	dataset_id: string
	base_model: string
	status: string // pending | running | completed | failed
	progress?: number
	created_at?: string
	completed_at?: string
}

export interface TrainedModel {
	id: string
	artifact_id: string
	name: string
	base_model: string
	status: string
	metrics?: Record<string, number>
	created_at?: string
	is_prefill_model?: boolean
	version?: string
	training_source?: string
}

export function fetchTrainingDatasets() {
	return request.get("training/datasets", { headers: authHeaders() }).json<{ items: TrainingDataset[] }>();
}

export function createDatasetFromApproved(payload: { name: string, modality?: string }) {
	return request.post("training/datasets/from-approved", { json: payload, headers: authHeaders() }).json<TrainingDataset>();
}

export function createReviewedDataset(payload: Record<string, unknown>) {
	return request.post("training/datasets/from-reviewed-qa", { json: payload, headers: authHeaders() }).json<TrainingDataset>();
}

export function fetchTrainingJobs() {
	return request.get("training/jobs", { headers: authHeaders() }).json<{ items: TrainingJob[] }>();
}

export function createTrainingJob(payload: {
	dataset_id: string
	base_model: string
	name?: string
	epochs?: number
	job_type?: string
	config?: Record<string, unknown>
}) {
	// 后端 CreateTrainingJobRequest 要求 name 必填，epochs 归入 config 字典
	const name = payload.name || `训练任务-${new Date().toLocaleString("zh-CN", { hour12: false })}`;
	const config = { ...(payload.config || {}), ...(payload.epochs != null ? { epochs: payload.epochs } : {}) };
	const body: Record<string, unknown> = {
		name,
		dataset_id: payload.dataset_id,
		base_model: payload.base_model,
		job_type: payload.job_type || "lora_sft",
		config,
	};
	return request.post("training/jobs", { json: body, headers: authHeaders() }).json<TrainingJob>();
}

export function runTrainingJob(jobId: string) {
	return request.post(`training/jobs/${jobId}/run`, { headers: authHeaders() }).json<TrainingJob>();
}

export function fetchTrainedModels() {
	return request.get("training/models", { headers: authHeaders() }).json<{ items: TrainedModel[] }>();
}

export function deployModel(artifactId: string, payload: { name?: string, set_as_prefill_model?: boolean }) {
	return request.post(`training/models/${artifactId}/deploy`, { json: payload, headers: authHeaders() }).json<TrainedModel>();
}

// ============================================================================
// 管理 (补全 — UserManagement/OrgSettings/SDKManagement 页)
// ============================================================================

export interface LabelUser {
	id: string
	username: string
	email?: string
	role: string
	is_active: boolean
	created_at?: string
}

export function listLabelUsers() {
	return request.get("admin/users", { headers: authHeaders() }).json<{ items: LabelUser[] }>();
}

export function createLabelUser(payload: { username: string, email: string, password: string, role?: string }) {
	return request.post("admin/users", { json: payload, headers: authHeaders() }).json<LabelUser>();
}

export function updateUserRole(userId: string, role: string) {
	return request.patch(`admin/users/${userId}/role`, { json: { role }, headers: authHeaders() }).json<LabelUser>();
}

export function updateUserStatus(userId: string, isActive: boolean) {
	return request.patch(`admin/users/${userId}/status`, { json: { is_active: isActive }, headers: authHeaders() }).json<LabelUser>();
}

export function listPermissions() {
	return request.get("admin/permissions", { headers: authHeaders() }).json<{ items: Array<{ code: string, name: string }> }>();
}

export function listRoles() {
	return request.get("admin/roles", { headers: authHeaders() }).json<{ items: Array<{ code: string, name: string, permissions: string[] }> }>();
}

export function updateRolePermissions(role: string, permissions: string[]) {
	return request.put(`admin/roles/${role}/permissions`, { json: { permissions }, headers: authHeaders() }).json<unknown>();
}

// ============================================================================
// 图片标注 — 区域分析 (ADR-013 多模态)
// ============================================================================

export interface RegionAnalysisResult {
	asset_id: string
	region_label: string
	question: string
	answer: string
	evidence?: string | null
	reasoning?: string | null
	score: number
	agreement_score: number
	similarity_mode?: string | null
	bucket: "green" | "orange" | "red"
	status: string
	candidate_models: string[]
	final_model?: string | null
	votes?: Array<Record<string, unknown>>
	failed_models?: Array<Record<string, unknown>>
}

/** 图片区域分析 (多模型投票 + 置信度分桶) */
export function analyzeRegion(params: { asset_id: string, image_base64: string, region_label?: string }) {
	return request
		.post("ai/region-analysis", {
			json: { region_label: "", ...params },
			headers: authHeaders(),
			timeout: 120000,
		})
		.json<RegionAnalysisResult>();
}

// ============================================================================
// 视频标注 — 关键帧分析 + 时间窗分析 (ADR-013 多模态)
// ============================================================================

export interface VideoFrameAnalysisResult {
	asset_id: string
	timestamp: number
	question: string
	answer: string
	evidence?: string | null
	reasoning?: string | null
	score: number
	agreement_score: number
	bucket: "green" | "orange" | "red"
	status: string
	candidate_models: string[]
	final_model?: string | null
	votes?: Array<Record<string, unknown>>
	failed_models?: Array<Record<string, unknown>>
}

export interface VideoWindowFrameResult {
	timestamp: number
	question: string
	answer: string
	score: number
	bucket: "green" | "orange" | "red"
	status: string
	description?: string
}

export interface VideoWindowAnalysisResult {
	asset_id: string
	start_timestamp: number
	end_timestamp: number
	question?: string
	answer?: string
	score: number
	agreement_score: number
	bucket: "green" | "orange" | "red"
	status: string
	frame_entries?: VideoWindowFrameResult[]
	candidate_models: string[]
}

/** 视频关键帧分析 */
export function analyzeVideoFrame(params: { asset_id: string, frame_base64: string, timestamp: number }) {
	return request
		.post("ai/video-frame-analysis", {
			json: params,
			headers: authHeaders(),
			timeout: 120000,
		})
		.json<VideoFrameAnalysisResult>();
}

/** 视频时间窗多帧分析 (2-6帧) */
export function analyzeVideoWindow(params: {
	asset_id: string
	start_timestamp: number
	end_timestamp: number
	trajectory_label?: string
	frames: Array<{ timestamp: number, frame_base64: string }>
}) {
	return request
		.post("ai/video-window-analysis", {
			json: { trajectory_label: "", ...params },
			headers: authHeaders(),
			timeout: 180000,
		})
		.json<VideoWindowAnalysisResult>();
}

// ============================================================================
// 多模态标注标签预设
// 定位为「通用智能标注系统」，默认「整体解读」，避免预设成工业缺陷检测场景。
// 用户可从预设中选择，也可自定义输入。
// ============================================================================

/** 图片区域分析标签预设 */
export const IMAGE_REGION_LABELS: string[] = [
	"整体解读", // 默认: 框选区域的整体内容/场景描述
	"目标识别", // 检测并命名区域内主体对象
	"属性描述", // 颜色/形状/状态/材质等可验证属性
	"场景理解", // 环境/上下文/语义场景
	"文字提取", // OCR 文字识别与转录
	"空间关系", // 物体间相对位置/交互关系
	"计数统计", // 数量/密度统计
	"异常检测", // 缺陷/异常/不符合项 (工业质检可选)
];

/** 图片区域分析默认标签 */
export const DEFAULT_IMAGE_REGION_LABEL = "整体解读";

/** 视频时间窗轨迹分析标签预设 */
export const VIDEO_TRAJECTORY_LABELS: string[] = [
	"整体流程解读", // 默认: 时间窗内整体发生的事
	"关键步骤分解", // 拆解为有序步骤
	"动作轨迹", // 主体运动轨迹变化
	"时序变化", // 随时间的状态/数量演变
	"事件识别", // 关键事件检测与定位
	"异常行为", // 异常/违规行为 (安防/质检可选)
];

/** 视频时间窗默认标签 */
export const DEFAULT_VIDEO_TRAJECTORY_LABEL = "整体流程解读";

/** 关键帧分析标签预设 */
export const VIDEO_FRAME_LABELS: string[] = [
	"整体解读", // 默认: 单帧整体内容
	"当前状态", // 此刻对象/场景状态
	"动作识别", // 正在进行的动作
	"物体检测", // 帧内可见对象清单
	"异常检测", // 异常/缺陷 (可选)
];

/** 关键帧默认标签 */
export const DEFAULT_VIDEO_FRAME_LABEL = "整体解读";

// ============================================================================
// 数据资产中心 — 高质量 QA 数据集浏览 / 打包导出
// ============================================================================

/** 高质量状态默认值 (人工审核通过 + 自动接受) */
export const HIGH_QUALITY_STATUSES = ["reviewed_accept", "reviewed_edit", "green_auto_skip"] as const;

/** 导出格式选项 */
export const DATASET_EXPORT_FORMATS = ["jsonl", "alpaca", "sharegpt", "csv"] as const;
export type DatasetExportFormat = (typeof DATASET_EXPORT_FORMATS)[number];

/** 数据集预览查询参数 */
export interface DatasetPreviewParams {
	statuses?: string[]
	buckets?: string[]
	min_confidence?: number
	page?: number
	page_size?: number
}

/** 数据集预览中的单条 QA */
export interface DatasetPreviewItem {
	id: string
	question: string
	answer: string
	evidence?: string | null
	reasoning?: string | null
	confidence: number
	score_bucket: string
	status: string
	modality: string
}

/** 数据集预览响应 */
export interface DatasetPreviewResponse {
	items: DatasetPreviewItem[]
	total: number
	page: number
	page_size: number
	distribution: {
		buckets: Record<string, number>
		statuses: Record<string, number>
	}
}

/** 打包导出参数 */
export interface DatasetExportParams {
	statuses?: string[]
	buckets?: string[]
	min_confidence?: number
	format: DatasetExportFormat
	train_ratio?: number
	dataset_name?: string
}

/** 导出历史条目 */
export interface DatasetExportRecord {
	id: string
	fingerprint: string | null
	format: string | null
	item_count: number | null
	train_count: number | null
	val_count: number | null
	dataset_name: string | null
	actor_id: string | null
	created_at: string | null
}

/** 预览高质量数据集 (分页 + 质量分布统计) */
export function previewDataset(params: DatasetPreviewParams) {
	return request
		.post("data/dataset/preview", {
			json: {
				statuses: HIGH_QUALITY_STATUSES,
				...params,
			},
			headers: authHeaders(),
		})
		.json<DatasetPreviewResponse>();
}

/** 打包高质量数据集为 ZIP 下载 (二进制流 → 浏览器下载) */
export async function exportDataset(params: DatasetExportParams): Promise<{ filename: string, blob: Blob }> {
	const resp = await request.post("data/dataset/export", {
		json: {
			statuses: HIGH_QUALITY_STATUSES,
			...params,
		},
		headers: authHeaders(),
		timeout: 120000,
	});
	const blob = await resp.blob();
	// 从 Content-Disposition 解析文件名
	const cd = resp.headers.get("content-disposition") || "";
	const match = /filename="([^"]+)"/.exec(cd);
	const filename = match?.[1] || `dataset_${params.format}_${Date.now()}.zip`;
	return { filename, blob };
}

/** 导出历史列表 */
export function listDatasetExports() {
	return request.get("data/dataset/exports", { headers: authHeaders() }).json<{ items: DatasetExportRecord[], total: number }>();
}
