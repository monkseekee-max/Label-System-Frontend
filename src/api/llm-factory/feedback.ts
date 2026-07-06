import type { FeedbackSample, FeedbackSource } from "./types";
import { factoryApi } from "./factory-client";

// ============================================================
// Feedback 回流 (ADR-019 P3-5)
// 操作性 API (mutating/state-query), 禁 mock fallback, 失败抛错.
// ============================================================

export async function ingestFeedback(
	opts: { source: FeedbackSource, content: string, modelTag: string, companyId: number, confidence?: number },
): Promise<FeedbackSample> {
	return factoryApi.ingestFeedback(opts.source, opts.content, opts.modelTag, opts.companyId, opts.confidence);
}

export async function listPendingFeedback(companyId: number): Promise<FeedbackSample[]> {
	return factoryApi.listPendingFeedback(companyId);
}

export async function generateFeedbackTasks(
	opts: { companyId: number, projectId: number, maxCount?: number },
): Promise<unknown> {
	return factoryApi.generateFeedbackTasks(opts.companyId, opts.projectId, opts.maxCount);
}
