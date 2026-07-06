import type { Dataset, DatasetListParams, DatasetStatus, TaskCategory } from "./types";
import { factoryApi } from "./factory-client";
import { delay, toApiResponse, withFallback } from "./shared";

const MOCK_DATASETS: Dataset[] = [
	{
		id: 1,
		name: "SFT_Instruction_v3",
		taskCategory: "TEXT_QA",
		sampleCount: 45230,
		version: 3,
		qualityScore: 92,
		status: "READY",
		updatedAt: "2025-06-10T10:25:00Z",
	},
	{
		id: 2,
		name: "ImageCaption_Dataset",
		taskCategory: "IMAGE_CAPTION",
		sampleCount: 28450,
		version: 2,
		qualityScore: 88,
		status: "READY",
		updatedAt: "2025-06-09T15:40:00Z",
	},
	{
		id: 3,
		name: "VideoQA_Clean",
		taskCategory: "VIDEO_QA",
		sampleCount: 12560,
		version: 1,
		qualityScore: 76,
		status: "PENDING_REVIEW",
		updatedAt: "2025-06-11T08:12:00Z",
	},
	{
		id: 4,
		name: "Multimodal_Align_v2",
		taskCategory: "IMAGE_QA",
		sampleCount: 18920,
		version: 2,
		qualityScore: 58,
		status: "FAILED",
		updatedAt: "2025-06-08T14:30:00Z",
	},
];

// Datasets
export function fetchDatasetList(params?: DatasetListParams) {
	const mock = () => delay(300).then(() => {
		let filtered = [...MOCK_DATASETS];
		if (params?.keyword) {
			filtered = filtered.filter(d => d.name.includes(params.keyword!));
		}
		if (params?.taskCategory) {
			filtered = filtered.filter(d => d.taskCategory === params.taskCategory);
		}
		if (params?.status) {
			filtered = filtered.filter(d => d.status === params.status);
		}
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 10;
		const start = (pageNo - 1) * pageSize;
		const records = filtered.slice(start, start + pageSize);
		return toApiResponse({ code: 200, message: "success", data: { records, total: filtered.length, pageNo, pageSize } });
	});
	return withFallback(async () => {
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 10;
		const offset = (pageNo - 1) * pageSize;
		const res = await factoryApi.getDatasets(undefined, params?.status as string | undefined, pageSize, offset);
		// 后端规范字段 → 前端类型映射
		const records: Dataset[] = res.records.map((r, idx) => ({
			id: idx + 1 + offset,
			name: r.setName,
			taskCategory: (r.trainingTaskType as TaskCategory) || "TEXT_QA",
			sampleCount: r.sampleCount,
			version: Number.parseInt(r.version?.replace(/^v/, "") || "1", 10) || 1,
			qualityScore: 0,
			status: _mapDatasetStatus(r.status),
			updatedAt: r.updateTime || "",
		}));
		return { records, total: res.total, pageNo, pageSize };
	}, mock);
}

/** 后端大写状态 → 前端 DatasetStatus */
function _mapDatasetStatus(raw: string): DatasetStatus {
	const s = (raw || "").toUpperCase();
	if (s === "CLEANED" || s === "FORMATTED")
		return "READY";
	if (s === "COLLECTED")
		return "PENDING_REVIEW";
	if (s === "FAILED")
		return "FAILED";
	return "READY";
}

export function fetchDatasetStats() {
	return withFallback(async () => {
		const o = await factoryApi.getDatasetsOverview();
		return {
			totalDatasets: o.datasetCount,
			totalSamples: o.totalSamples,
			totalVersions: o.versionCount,
			avgQualityScore: Math.round(o.avgQualityScore),
		};
	}, () => delay(150).then(() => toApiResponse({
		code: 200,
		message: "success",
		data: {
			totalDatasets: MOCK_DATASETS.length,
			totalSamples: MOCK_DATASETS.reduce((sum, d) => sum + d.sampleCount, 0),
			totalVersions: MOCK_DATASETS.reduce((sum, d) => sum + d.version, 0),
			avgQualityScore: Math.round(MOCK_DATASETS.reduce((sum, d) => sum + d.qualityScore, 0) / MOCK_DATASETS.length),
		},
	})));
}
