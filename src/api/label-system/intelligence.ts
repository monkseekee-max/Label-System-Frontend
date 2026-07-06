// ============================================================================
// 智能标注四引擎 API (ADR-015)
// 通过 BFF 代理 /api/intelligence/* 访问 intelligence 服务 (8106)
// ============================================================================

import { request } from "#src/utils/request";

// ── 引擎② 置信度路由 ──────────────────────────────────────────
export interface RouteDecision {
	route: "auto_accept" | "human_review" | "sampled_review"
	auto_accepted: boolean
	requires_human_review: boolean
	reason: string
	prefill_source: string
}

export interface RoutingStats {
	total: number
	auto_accepted: number
	human_review: number
	verifier_overrides: number
	human_savings_rate: number
}

export function routeItem(params: {
	score_bucket: string
	confidence: number
	verification_verdict?: string | null
}): Promise<RouteDecision> {
	return request
		.post("intelligence/route", {
			json: { ...params, sampling_rate: 0.05 },
		})
		.json<RouteDecision>();
}

export function routeBatch(items: Array<{ score_bucket: string, confidence: number, verification_verdict?: string | null }>): Promise<{ decisions: RouteDecision[], stats: RoutingStats }> {
	return request.post("intelligence/route/batch", { json: { items } }).json();
}

// ── 引擎③ 验证器 ──────────────────────────────────────────────
export interface VerificationResult {
	evidence_alignment: number
	factuality: number
	self_consistency: number
	checks_passed: string[]
	checks_failed: string[]
	hallucination_flag: boolean
	overall_verdict: "pass" | "warn" | "fail"
	details: Record<string, { score: number, detail: string }>
	result_id: string | null
}

export function verifyQAItem(params: {
	question: string
	answer: string
	evidence?: string | null
	reasoning?: string | null
	rag_context?: string | null
}): Promise<VerificationResult> {
	return request.post("intelligence/verify", { json: { verifier_model: "verifier-v1", ...params } }).json();
}

// ── 引擎④ 进化闭环 ────────────────────────────────────────────
export interface ErrorSetStats {
	total_reviews: number
	actionable_corrections: number
	answer_changed: number
	rejected: number
	accepted_as_is: number
	dpo_pairs: number
	negative_samples: number
	error_rate: number
	is_training_worthy: boolean
}

export interface IncrementalPlan {
	should_trigger: boolean
	parent_artifact_id: string | null
	base_model: string
	reviewed_qa_count: number
	error_set_count: number
	dpo_pair_count: number
	replay_ratio: number
	reason: string
	correction_source: Record<string, unknown>
}

export function fetchErrorSet(): Promise<ErrorSetStats> {
	return request.get("intelligence/evolution/error-set").json();
}

export function planIncrementalTraining(params?: {
	base_model?: string
	parent_artifact_id?: string
}): Promise<IncrementalPlan> {
	return request.post("intelligence/evolution/plan-incremental", { json: params ?? {} }).json();
}

export function extractPreferences(qa_item_ids?: string[]): Promise<{ created: number, total_reviews: number }> {
	return request
		.post("intelligence/evolution/extract-preferences", { json: { qa_item_ids: qa_item_ids ?? [] } })
		.json();
}

// ── 引擎① 主动学习 ────────────────────────────────────────────
export interface AcquisitionCandidateInput {
	asset_id: string
	qa_item_id?: string
	confidence: number
	margin: number
	agreement_score: number
	domain?: string | null
}

export interface AcquisitionRankResult {
	selected: Array<{
		asset_id: string
		qa_item_id: string | null
		final_priority: number
		strategy_scores: Record<string, number>
		domain: string | null
	}>
	strategy_distribution: Record<string, number>
	domain_distribution: Record<string, number>
	avg_priority: number
}

export function rankCandidates(params: { candidates: AcquisitionCandidateInput[], top_k?: number }): Promise<AcquisitionRankResult> {
	return request.post("intelligence/acquisition/rank", { json: { top_k: 50, ...params } }).json();
}

// ── 总览仪表盘 ────────────────────────────────────────────────
export interface IntelligenceDashboard {
	engine_2_routing: {
		green: number
		orange: number
		red: number
		auto_accepted: number
	}
	engine_3_quality: {
		verified_items: number
		gold_set_size: number
	}
	engine_4_evolution: {
		total_reviews: number
		actionable_corrections: number
		error_rate: number
		dpo_pairs_available: number
		preference_pairs_stored: number
		is_training_worthy: boolean
	}
	flywheel_status: {
		has_correction_signal: boolean
		has_preference_pairs: boolean
		ready_for_incremental: boolean
	}
}

export function fetchIntelligenceDashboard(): Promise<IntelligenceDashboard> {
	return request.get("intelligence/dashboard").json();
}

// ── 升级: 语义验证器 + 预填 + 真实训练 + 黄金题 ──────────────

export interface SemanticVerifyResult extends VerificationResult {
	used_semantic: boolean
}

export function verifySemantic(params: {
	question: string
	answer: string
	evidence?: string | null
	reasoning?: string | null
	rag_context?: string | null
}): Promise<SemanticVerifyResult> {
	return request.post("intelligence/verify/semantic", { json: params }).json();
}

export interface PrefillStatus {
	has_prefill_model: boolean
	prefill_model_id: string | null
	prefill_model_version: string | null
	should_prefill: boolean
	total_artifacts: number
}

export function fetchPrefillStatus(): Promise<PrefillStatus> {
	return request.get("intelligence/prefill/status").json();
}

export interface AutoTriggerResult {
	should_trigger: boolean
	trigger_reason: string
	training_mode: string
	sft_data_count: number
	dpo_pair_count: number
	estimated_duration_min: number
}

export function checkAutoTrigger(): Promise<AutoTriggerResult> {
	return request.post("intelligence/evolution/auto-trigger-check", { json: {} }).json();
}

export interface RealTrainDryRunResult {
	dry_run: true
	sft_exported: number
	sft_path: string
	dpo_path: string | null
	message: string
}

export interface RealTrainResult {
	real_training: boolean
	task_id: string
	version_tag: string
	sft_exported: number
	training_job_id: string
	track_url?: string
	message: string
}

export function triggerRealTraining(params: {
	training_mode?: string
	dry_run?: boolean
}): Promise<RealTrainDryRunResult | RealTrainResult> {
	return request.post("intelligence/evolution/trigger-real-training", { json: params }).json();
}

export interface AnnotatorWorkload {
	annotators: Array<{
		user_id: string
		total_reviews: number
		edits: number
		edit_rate: number
		gold_accuracy: number | null
		drift_detected: boolean
	}>
	total_annotators: number
	total_reviews: number
	needs_more_annotators: boolean
}

export function fetchAnnotatorWorkload(): Promise<AnnotatorWorkload> {
	return request.get("intelligence/annotators/workload").json();
}

// ── 补全: 黄金题种子 + 手动录入 + 预填种子 + 自动路由 ──────────

export function seedGoldFromReviewed(params: { min_confidence?: number, max_items?: number }): Promise<{ seeded: number, total_gold: number }> {
	return request.post("intelligence/gold/seed-from-reviewed", { json: params }).json();
}

export function addGoldItem(params: {
	question: string
	canonical_answer: string
	canonical_evidence?: string | null
	difficulty?: string
	domain?: string | null
}): Promise<{ id: string }> {
	return request.post("intelligence/gold/items", { json: params }).json();
}

export function fetchGoldItems(): Promise<{ items: Array<{ id: string, question: string, canonical_answer: string, difficulty: string, domain: string | null }>, total: number }> {
	return request.get("intelligence/gold/items").json();
}

export function seedPrefill(params: { asset_ids?: string[], model_alias?: string }): Promise<{ prefilled: number, assets_processed: number, model: string }> {
	return request.post("intelligence/prefill/seed", { json: params }).json();
}

export function autoRouteBatch(params: { qa_item_ids?: string[], sampling_rate?: number }): Promise<{ total: number, auto_accepted: number, human_review: number, sampled: number, human_savings_rate: number, updated: number }> {
	return request.post("intelligence/evolution/auto-route-batch", { json: params }).json();
}

// ── 引擎③ 黄金题集 / IAA ──────────────────────────────────────
export function computeIAA(rating_matrix: number[][]): Promise<{ kappa: number, agreement_level: string, num_items: number, num_raters: number }> {
	return request.post("intelligence/iaa", { json: { rating_matrix } }).json();
}
