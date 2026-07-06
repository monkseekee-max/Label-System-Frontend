import { isSuccessResponse } from "#src/api/shared";
import { request } from "#src/utils/request";

/** 审计日志记录 (与后端 GET /api/v1/audit/logs 对齐, 需 admin 角色). */
export interface AuditLogRecord {
	id: number
	companyId: number
	actor: string
	actorType: "machine" | "human" | string
	action: string
	resourceType: string | null
	resourceId: string | null
	before: unknown
	after: unknown
	ip: string | null
	userAgent: string | null
	createdAt: string
}

export interface AuditLogPage {
	records: AuditLogRecord[]
	total: number
	offset: number
	limit: number
}

export interface AuditLogListParams {
	offset?: number
	limit?: number
}

interface RawResponse<T> {
	code: number
	message: string
	data: T
}

function toApiResponse<T>(raw: RawResponse<T>): ApiResponse<T> {
	return {
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data,
	};
}

/** 读取审计日志 (最近活动). 需 admin 角色, 前端走登录态 JWT. */
export function fetchAuditLogs(params?: AuditLogListParams) {
	return request
		.get("v1/audit/logs", { searchParams: { offset: String(params?.offset ?? 0), limit: String(params?.limit ?? 20) } })
		.json<RawResponse<AuditLogPage>>()
		.then(toApiResponse);
}

/** 将审计 action 代码映射为可读中文描述 (用于「最近活动」展示). */
export function describeAuditAction(action: string, record: AuditLogRecord): string {
	const after = record.after as Record<string, unknown> | null;
	const count = typeof after?.count === "number" ? after.count : null;
	switch (action) {
		case "data.export":
			return `导出标注数据（${count ?? 0} 条，格式 ${(after?.format as string) ?? "-"}）`;
		case "auto_mitigator.restart_vllm.succeeded":
			return "自动恢复：vLLM 重启成功";
		case "auto_mitigator.restart_vllm.started":
			return "自动恢复：触发 vLLM 重启";
		case "auto_mitigator.pause_scheduler.succeeded":
			return "自动恢复：调度器已暂停";
		case "auto_mitigator.pause_scheduler.started":
			return "自动恢复：暂停调度器";
		case "auto_mitigator.cleanup_old_outputs.succeeded":
			return "自动维护：清理旧产物成功";
		case "auto_mitigator.cleanup_old_outputs.started":
			return "自动维护：开始清理旧产物";
		case "auto_mitigator.recording_action.succeeded":
			return "自动恢复：动作记录完成";
		case "auto_mitigator.failing_action.failed":
			return "自动恢复：动作失败告警";
		default: {
			// 通用映射: 把 a.b.c → "a · b · c" 降级展示, 不编造语义
			if (action.startsWith("auto_mitigator.")) {
				return `自动运维：${action.replace("auto_mitigator.", "")}`;
			}
			return action;
		}
	}
}
