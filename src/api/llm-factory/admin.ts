import { useAuthStore } from "#src/store/auth";
import ky from "ky";

function authHeaders(): Record<string, string> {
	return { Authorization: `Bearer ${useAuthStore.getState().token || ""}` };
}

export interface AuditLogItem {
	id: number
	companyId: number
	actor: string
	actorType: string
	action: string
	resourceType: string
	resourceId: string | null
	before: Record<string, unknown> | null
	after: Record<string, unknown> | null
	ip: string | null
	userAgent: string | null
	createdAt: string | null
}

export interface AuditPage {
	records: AuditLogItem[]
	total: number
	offset: number
	limit: number
}

export function fetchAuditLogs(params: {
	pageNo?: number
	pageSize?: number
	actor?: string
	action?: string
	resource_type?: string
}): Promise<{ code: number, data: AuditPage }> {
	const offset = (params.pageNo ?? 1) > 0 ? ((params.pageNo ?? 1) - 1) * (params.pageSize ?? 20) : 0;
	const { pageNo, pageSize, ...rest } = params;
	return ky.get("/api/v1/audit/logs", {
		searchParams: { offset, limit: pageSize ?? 20, ...rest },
		headers: authHeaders(),
	}).json();
}

export interface MachineTokenItem {
	id: number
	companyId: number
	name: string
	scopes: string[]
	issuedBy: string
	issuedAt: string | null
	expiresAt: string | null
	revokedAt: string | null
	lastUsedAt: string | null
}

export function listMachineTokens(): Promise<{ code: number, data: MachineTokenItem[] }> {
	return ky.get("/api/v1/auth/tokens", { headers: authHeaders() }).json();
}

export function createMachineToken(payload: {
	name: string
	scopes?: string[]
	ttl_days?: number
}): Promise<{ code: number, data: { token: string, record: MachineTokenItem } }> {
	return ky.post("/api/v1/auth/tokens", { json: payload, headers: authHeaders() }).json();
}

export function revokeMachineToken(tokenId: number): Promise<{ code: number, data: MachineTokenItem }> {
	return ky.post(`/api/v1/auth/tokens/${tokenId}/revoke`, { headers: authHeaders() }).json();
}

export interface SloSnapshot {
	windowHours: number
	companyId: number | null
	training: {
		windowHours: number
		total: number
		counts: Record<string, number>
		successRate: number
		medianDurationSec: number | null
		note?: string
	}
	label: { companyId: number | null, total: number, counts: Record<string, number> }
	model: {
		companyId: number | null
		windowHours: number
		gateAttempts: number
		gatePassed: number
		gatePassRate: number
		rollbackCount: number
		feedbackCount: number
	}
	gpu: { available: boolean, reason?: string }
	api: { available: boolean, reason?: string, windowHours: number }
}

export function fetchSloSnapshot(window = 24): Promise<{ code: number, data: SloSnapshot }> {
	return ky.get("/api/v1/observability/slo", { searchParams: { window }, headers: authHeaders() }).json();
}

export interface AlertItem {
	level: string
	category: string
	metric: string
	value: number
	threshold: number
	message: string
}

export function fetchAlerts(window = 24): Promise<{ code: number, data: { alerts: AlertItem[] } }> {
	return ky.get("/api/v1/observability/alerts", { searchParams: { window }, headers: authHeaders() }).json();
}
