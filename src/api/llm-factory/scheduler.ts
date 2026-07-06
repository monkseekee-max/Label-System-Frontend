// 训练调度 API + 派生数据 (ADR: scheduler 后端裸数据, 无 code/data 信封)
// 后端端点: /api/v1/scheduler/{mode, status, proposals, approve, trigger}
import { request } from "#src/utils/request";

// ============================================================
// 类型 (对应后端 src/app/scheduler/routes.py)
// ============================================================

/** GET /scheduler/status 返回 */
export interface SchedulerStatus {
	should_trigger: boolean
	mode: string // manual | semi_auto | auto
	reason: string
	stats: {
		cleaned_count: number
		total_count: number
		new_since_last: number
		avg_quality: number
		last_training_at: string | null
	}
}

/** GET /scheduler/proposals 返回的单条建议 (后端 pending_approvals 项) */
export interface SchedulerProposal {
	proposal_id: string
	status: string // pending | approved
	created_at?: string
	approved_at?: string | null
	reason?: string
	[key: string]: unknown
}

/** GET /scheduler/mode 返回 */
export interface SchedulerModeResp {
	mode: string
}

// ============================================================
// 前端 mode 与后端 mode 互转
// 后端: manual | semi_auto | auto ; 前端展示: manual | semi | auto
// ============================================================
export type FrontendMode = "manual" | "semi" | "auto";

export function toFrontendMode(backendMode: string): FrontendMode {
	return backendMode === "semi_auto" ? "semi" : (backendMode as FrontendMode);
}

export function toBackendMode(mode: FrontendMode): string {
	return mode === "semi" ? "semi_auto" : mode;
}

// ============================================================
// API 函数 (裸数据, scheduler 后端无信封)
// ============================================================

export function fetchSchedulerMode(): Promise<SchedulerModeResp> {
	return request.get("v1/scheduler/mode").json<SchedulerModeResp>();
}

export function updateSchedulerMode(mode: FrontendMode): Promise<SchedulerModeResp> {
	return request.put("v1/scheduler/mode", { json: { mode: toBackendMode(mode) } }).json<SchedulerModeResp>();
}

export function fetchSchedulerStatus(): Promise<SchedulerStatus> {
	return request.get("v1/scheduler/status").json<SchedulerStatus>();
}

export function fetchSchedulerProposals(): Promise<{ proposals: SchedulerProposal[] }> {
	return request.get("v1/scheduler/proposals").json<{ proposals: SchedulerProposal[] }>();
}

/** 批准训练建议 (后端: proposal_id 走 query param) */
export function approveProposal(proposalId: string): Promise<{ status: string, proposal_id: string }> {
	return request.post(`v1/scheduler/approve?proposal_id=${encodeURIComponent(proposalId)}`).json();
}

// ============================================================
// 派生: mode 标签 (替代调度器页硬编码 MODE_TAG_LABELS, 用真实 status.mode)
// ============================================================

export const MODE_LABELS: Record<FrontendMode, string> = {
	auto: "自动",
	semi: "半自动",
	manual: "手动",
};

export const MODE_COLORS: Record<FrontendMode, string> = {
	auto: "#165DFF",
	semi: "#faad14",
	manual: "#165DFF",
};
