import type { DataPipelineRun, PipelineRunListParams, PipelineSource, PipelineStatus } from "./types";
import { factoryApi } from "./factory-client";
import { delay, toApiResponse, withFallback } from "./shared";

const MOCK_PIPELINE_RUNS: DataPipelineRun[] = [
	{
		id: "pipeline-001",
		source: "API",
		recordCount: 1247,
		status: "COMPLETED",
		duration: 8,
		completedAt: "2025-06-11T09:00:00Z",
	},
	{
		id: "pipeline-002",
		source: "UPLOAD",
		recordCount: 5600,
		status: "COMPLETED",
		duration: 12,
		completedAt: "2025-06-10T16:30:00Z",
	},
	{
		id: "pipeline-003",
		source: "DVC",
		recordCount: 8900,
		status: "PARTIAL_FAILED",
		duration: 25,
		completedAt: "2025-06-09T11:20:00Z",
	},
];

// Data Pipeline
export function fetchPipelineRunList(params?: PipelineRunListParams) {
	return withFallback(async () => {
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 10;
		const offset = (pageNo - 1) * pageSize;
		const res = await factoryApi.getDataBatches(
			undefined,
			params?.source?.toLowerCase(),
			params?.status?.toLowerCase(),
			pageSize,
			offset,
		);
		const records: DataPipelineRun[] = res.records.map(b => ({
			id: b.batchId,
			source: (b.source.toUpperCase() as PipelineSource) || "UPLOAD",
			recordCount: b.recordCount,
			status: (b.status.toUpperCase() as PipelineStatus) || "COMPLETED",
			duration: 0,
			completedAt: b.createdAt || "",
		}));
		return { records, total: res.total, pageNo, pageSize };
	}, () => delay(300).then(() => {
		let filtered = [...MOCK_PIPELINE_RUNS];
		if (params?.source)
			filtered = filtered.filter(r => r.source === params.source);
		if (params?.status)
			filtered = filtered.filter(r => r.status === params.status);
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 10;
		const start = (pageNo - 1) * pageSize;
		const records = filtered.slice(start, start + pageSize);
		return toApiResponse({ code: 200, message: "success", data: { records, total: filtered.length, pageNo, pageSize } });
	}));
}

export function fetchPipelineStats() {
	return withFallback(async () => {
		const res = await factoryApi.getDataBatches(undefined, undefined, undefined, 1000, 0);
		const apiBatches = res.records.filter(b => b.source === "API");
		const uploadBatches = res.records.filter(b => b.source === "UPLOAD");
		const dvcBatches = res.records.filter(b => b.source === "DVC");
		return {
			apiTodayCount: apiBatches.reduce((s, b) => s + b.recordCount, 0),
			apiQueueSize: 0,
			apiStatus: apiBatches.some(b => b.status === "PARTIAL_FAILED") ? "PARTIAL_FAILED" : "RUNNING",
			uploadBatchCount: uploadBatches.length,
			uploadPending: uploadBatches.filter(b => b.status === "PARTIAL_FAILED").length,
			dvcSyncedCount: dvcBatches.reduce((s, b) => s + b.recordCount, 0),
			dvcLastSync: dvcBatches[0]?.createdAt || "",
		};
	}, () => delay(150).then(() => toApiResponse({
		code: 200,
		message: "success",
		data: { apiTodayCount: 1247, apiQueueSize: 0, apiStatus: "RUNNING", uploadBatchCount: 12, uploadPending: 3, dvcSyncedCount: 8900, dvcLastSync: "2h ago" },
	})));
}
