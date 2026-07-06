import type { Benchmark, EvalJob, EvalJobListParams, GateResult, TaskCategory } from "./types";
import { factoryApi } from "./factory-client";
import { delay, toApiResponse, withFallback } from "./shared";

const MOCK_EVAL_JOBS: EvalJob[] = [
	{
		id: "eval-001",
		loraVersion: "lora_v20260610_001",
		model: "Qwen3-8B",
		benchmark: "MMLU",
		scores: {
			metric1: 72.5,
			metric2: 68.3,
			metric3: 81.2,
			metric4: 15.8,
		},
		gateResult: "PASS",
		duration: 45,
		completedAt: "2025-06-10T20:00:00Z",
	},
	{
		id: "eval-002",
		loraVersion: "lora_v20260608_002",
		model: "Qwen3-8B",
		benchmark: "MMLU",
		compareVersion: "lora_v20260605_001",
		scores: {
			metric1: 65.2,
			metric2: 62.1,
			metric3: 74.5,
			metric4: 22.3,
		},
		gateResult: "FAIL",
		duration: 48,
		completedAt: "2025-06-09T18:30:00Z",
	},
];

const MOCK_BENCHMARKS: Benchmark[] = [
	{
		id: 1,
		name: "MMLU",
		sampleCount: 14054,
		taskCategory: "TEXT_QA",
		createdAt: "2025-05-15T10:00:00Z",
		filePath: "/data/benchmarks/mmlu.jsonl",
	},
	{
		id: 2,
		name: "COCO_Caption",
		sampleCount: 5000,
		taskCategory: "IMAGE_CAPTION",
		createdAt: "2025-05-10T14:00:00Z",
		filePath: "/data/benchmarks/coco_caption.jsonl",
	},
	{
		id: 3,
		name: "VQA_v2",
		sampleCount: 12000,
		taskCategory: "IMAGE_QA",
		createdAt: "2025-05-08T09:00:00Z",
		filePath: "/data/benchmarks/vqa_v2.jsonl",
	},
];

// Evaluation
export function fetchEvalJobList(params?: EvalJobListParams) {
	const mock = () => delay(300).then(() => {
		let filtered = [...MOCK_EVAL_JOBS];
		if (params?.loraVersion)
			filtered = filtered.filter(j => j.loraVersion === params.loraVersion);
		if (params?.benchmark)
			filtered = filtered.filter(j => j.benchmark === params.benchmark);
		if (params?.gateResult)
			filtered = filtered.filter(j => j.gateResult === params.gateResult);
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
		const res = await factoryApi.getEvalResults(undefined, params?.loraVersion, params?.benchmark, undefined, pageSize, offset);
		const records: EvalJob[] = res.records.map((r) => {
			const s = r.scores || {};
			const qaGen = (s.qaGenerate as { accuracy?: number }) || {};
			const qaAns = (s.qaAnswer as { f1?: number, rougeL?: number }) || {};
			const halluc = s.hallucinationRate as number | undefined;
			return {
				id: r.jobId,
				loraVersion: r.loraVersion,
				model: r.modelName,
				benchmark: r.benchmarkId,
				scores: {
					metric1: Math.round(((qaGen.accuracy ?? 0) * 10000)) / 100,
					metric2: Math.round(((qaAns.f1 ?? 0) * 10000)) / 100,
					metric3: Math.round(((qaAns.rougeL ?? 0) * 10000)) / 100,
					metric4: Math.round(((halluc ?? 0) * 10000)) / 100,
				},
				gateResult: (r.gateDecision as GateResult) || "PASS",
				duration: r.duration,
				completedAt: r.completedAt || "",
			};
		});
		return { records, total: res.total, pageNo, pageSize };
	}, mock);
}

export function fetchBenchmarkList() {
	return withFallback(async () => {
		const res = await factoryApi.getBenchmarks();
		return res.benchmarks.map((b, idx): Benchmark => ({
			id: idx + 1,
			name: b.name,
			sampleCount: b.sampleCount,
			taskCategory: (b.benchmarkType as TaskCategory) || "TEXT_QA",
			createdAt: b.createdAt,
			filePath: b.filePath,
			benchmarkId: b.benchmarkId,
		}));
	}, () => delay(200).then(() => toApiResponse({ code: 200, message: "success", data: MOCK_BENCHMARKS })));
}

// 原始端点返回类型 (无信封, factoryApi 层适配)
export interface BenchmarkSample {
	id?: string
	type?: string
	input?: Record<string, unknown>
	expected?: Record<string, unknown>
	[key: string]: unknown
}

export interface BenchmarkDetail {
	benchmarkId: string
	name: string
	description: string
	sampleCount: number
	filePath: string
	taskCategory: TaskCategory
	isLocked: boolean
	createdAt: string
	samples: BenchmarkSample[]
}

export interface CreateBenchmarkPayload {
	name: string
	description?: string
	benchmarkId?: string
	samples?: BenchmarkSample[]
}

export interface RunEvalPayload {
	loraVersion: string
	benchmarkId?: string
	compareWith?: string
	runRegression?: boolean
	model1?: string
	vllmBaseUrl?: string
}

export interface RunEvalResult {
	jobId: string
	status: string
	loraVersion: string
	benchmarkId: string | null
	model1: string
	pollUrl: string
}

export async function fetchBenchmarkDetail(benchmarkId: string): Promise<BenchmarkDetail> {
	const res = await factoryApi.getBenchmarkDetail(benchmarkId);
	return {
		benchmarkId: res.benchmarkId,
		name: res.name,
		description: res.description || "",
		sampleCount: res.sampleCount,
		filePath: res.filePath,
		taskCategory: (res.benchmarkType as TaskCategory) || "TEXT_QA",
		isLocked: res.isLocked,
		createdAt: res.createdAt,
		samples: res.samples || [],
	};
}

export async function createBenchmark(payload: CreateBenchmarkPayload): Promise<{ benchmarkId: string, name: string, sampleCount: number }> {
	const res = await factoryApi.createBenchmark(payload);
	return { benchmarkId: res.benchmarkId, name: res.name, sampleCount: res.sampleCount };
}

export async function runEvaluation(payload: RunEvalPayload): Promise<RunEvalResult> {
	const res = await factoryApi.runEval(payload);
	return {
		jobId: res.jobId,
		status: res.status,
		loraVersion: res.loraVersion,
		benchmarkId: res.benchmarkId,
		model1: res.model1,
		pollUrl: res.pollUrl,
	};
}
