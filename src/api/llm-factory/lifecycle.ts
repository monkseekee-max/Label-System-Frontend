import type { AliasRollbackResponse, AliasSetResponse, CanaryRatioResponse, GateDecision, LifecycleDetailResponse, LifecycleStateResponse, ModelAliasName, ModelContextReport, ModelLifecycleState } from "./types";
import { factoryApi } from "./factory-client";

// ============================================================
// Lifecycle / Alias / Context 操作函数 (ADR-019 P3-1/P3-3/P3-4)
//
// 这些是操作性 API (mutating/state-query), 按 ADR-019 P0-1 禁止 mock fallback,
// 失败直接抛错 (调用方自行处理错误态).
// ============================================================

export async function registerModelVersion(
	versionTag: string,
	opts: { companyId: number, modelFamily: string, state?: ModelLifecycleState },
): Promise<LifecycleStateResponse> {
	return factoryApi.registerVersion(versionTag, opts.companyId, opts.modelFamily, opts.state);
}

export async function getModelLifecycle(versionTag: string): Promise<LifecycleDetailResponse> {
	return factoryApi.getLifecycle(versionTag);
}

export async function promoteModelVersion(
	versionTag: string,
	gateDecision: GateDecision,
	opts?: { companyId?: number, actor?: string },
): Promise<LifecycleStateResponse> {
	return factoryApi.promoteToProd(versionTag, gateDecision, opts?.companyId, opts?.actor);
}

export async function archiveModelVersion(
	versionTag: string,
	opts?: { actor?: string, reason?: string },
): Promise<LifecycleStateResponse> {
	return factoryApi.archiveVersion(versionTag, opts?.actor, opts?.reason);
}

export async function discardModelVersion(
	versionTag: string,
	opts?: { actor?: string, reason?: string },
): Promise<LifecycleStateResponse> {
	return factoryApi.discardVersion(versionTag, opts?.actor, opts?.reason);
}

export async function setModelAlias(
	alias: ModelAliasName,
	opts: { companyId: number, modelFamily: string, versionTag: string },
): Promise<AliasSetResponse> {
	return factoryApi.setAlias(alias, opts.companyId, opts.modelFamily, opts.versionTag);
}

export async function getModelAlias(
	companyId: number,
	modelFamily: string,
	alias: ModelAliasName,
): Promise<string> {
	return factoryApi.getAlias(companyId, modelFamily, alias);
}

export async function setCanaryRatio(
	opts: { companyId: number, modelFamily: string, ratio: number },
): Promise<CanaryRatioResponse> {
	return factoryApi.setCanaryRatio(opts.companyId, opts.modelFamily, opts.ratio);
}

export async function rollbackModelAlias(
	opts: { companyId: number, modelFamily: string, actor?: string, reason?: string },
): Promise<AliasRollbackResponse> {
	return factoryApi.rollbackAlias(opts.companyId, opts.modelFamily, opts.actor, opts.reason);
}

export async function getModelContext(versionTag: string): Promise<ModelContextReport> {
	return factoryApi.getModelContext(versionTag);
}
