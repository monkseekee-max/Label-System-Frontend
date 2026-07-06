import type { InferencePort, Model, PortType, TaskCategory } from "./types";
import { fetchSystemInfo } from "./ops-board";
import { factoryApi } from "./factory-client";
import { delay, toApiResponse, withFallback } from "./shared";

const MOCK_MODELS: Model[] = [
	{
		id: "model-1",
		name: "Qwen3-8B",
		repoPath: "/models/qwen3-8b",
		type: "TEXT_BASE",
		params: "8B",
		diskSize: "~16GB",
		track: "unsloth_sft",
		inferencePort: 8001,
		taskCategories: ["TEXT_QA"],
		contextLength: 4096,
		vramTotal: 24,
		vramUsed: 17.3,
		loraVersions: [
			{
				id: "lora_v20260610_001",
				tag: "lora_v20260610_001",
				baseModel: "Qwen3-8B",
				path: "/models/lora/lora_v20260610_001",
				isActive: true,
				createdAt: "2025-06-10T12:00:00Z",
			},
			{
				id: "lora_v20260608_002",
				tag: "lora_v20260608_002",
				baseModel: "Qwen3-8B",
				path: "/models/lora/lora_v20260608_002",
				isActive: false,
				createdAt: "2025-06-08T14:00:00Z",
			},
		],
	},
	{
		id: "model-2",
		name: "Qwen3.5-4B",
		repoPath: "/models/qwen3.5-4b",
		type: "MULTIMODAL",
		params: "4B+0.3B ViT",
		diskSize: "9.3GB",
		track: "hf_peft_lora",
		inferencePort: 8002,
		taskCategories: ["IMAGE_QA", "VIDEO_QA", "IMAGE_CAPTION"],
		contextLength: 262144,
		vramTotal: 24,
		vramUsed: 20.4,
		loraVersions: [
			{
				id: "mm_v20260609_001",
				tag: "mm_v20260609_001",
				baseModel: "Qwen3.5-4B",
				path: "/models/lora/mm_v20260609_001",
				isActive: true,
				createdAt: "2025-06-09T10:00:00Z",
			},
		],
	},
];

const MOCK_INFERENCE_PORTS: InferencePort[] = [
	{
		port: 8001,
		type: "TEXT",
		status: "ONLINE",
		requestsPerSecond: 45,
		p50Latency: 89,
		vramUsed: 17.3,
		vramTotal: 24,
		loraAdapters: [
			{
				id: "lora_v20260610_001",
				name: "lora_v20260610_001",
				isActive: true,
				requestRate: 28,
			},
			{
				id: "lora_v20260608_002",
				name: "lora_v20260608_002",
				isActive: false,
				requestRate: 0,
			},
		],
	},
	{
		port: 8002,
		type: "MULTIMODAL",
		status: "ONLINE",
		requestsPerSecond: 12,
		p50Latency: 342,
		vramUsed: 20.4,
		vramTotal: 24,
		loraAdapters: [
			{
				id: "mm_v20260609_001",
				name: "mm_v20260609_001",
				isActive: true,
				requestRate: 12,
			},
		],
	},
];

// Models
export function fetchModelList() {
	return withFallback(async () => {
		const res = await factoryApi.getLoraVersions();
		// 后端按基座分组的 models → 前端 Model[] (保持字段兼容)
		return res.models.map((m): Model => ({
			id: m.modelName,
			name: m.modelName,
			repoPath: m.modelPath,
			type: m.inferencePort === 8002 ? "MULTIMODAL" : "TEXT_BASE",
			params: m.parameterSize,
			diskSize: m.diskSize,
			track: m.trainingTrack,
			inferencePort: m.inferencePort,
			taskCategories: (m.taskTypes as TaskCategory[]) || [],
			contextLength: m.contextLength,
			vramTotal: 0,
			vramUsed: 0,
			loraVersions: m.loraVersions.map(v => ({
				id: v.versionTag,
				tag: v.versionTag,
				baseModel: m.modelName,
				path: v.loraPath,
				isActive: v.isActive,
				createdAt: v.createdAt,
			})),
		}));
	}, () => delay(200).then(() => toApiResponse({ code: 200, message: "success", data: MOCK_MODELS })));
}

// Inference
export function fetchInferencePorts() {
	return withFallback(async () => {
		// 并行获取: LoRA 版本 (适配器列表) + 系统总览 (vLLM 真实 running/GPU vram)
		// system/info 的 vllm.running 是真实探活 (后端 _find_vllm_pids + /v1/models)
		const [res, systemInfo] = await Promise.all([
			factoryApi.getLoraVersions(),
			fetchSystemInfo().catch(() => null),
		]);
		const vllmText = systemInfo?.vllm?.text;
		const vllmMm = systemInfo?.vllm?.multimodal;
		const gpuVramTotal = systemInfo?.gpu?.vram_total_gb ?? 24;
		// 从 lora 版本推导推理端口状态 (active lora 在对应端口)
		const ports: InferencePort[] = [
			{ port: 8001, type: "TEXT" as PortType, status: vllmText?.running ? "ONLINE" : "OFFLINE", requestsPerSecond: vllmText?.running ? 25.5 : 0, p50Latency: vllmText?.running ? 120 : 0, vramUsed: vllmText?.running ? (systemInfo?.gpu?.vram_used_gb ?? 0) : 0, vramTotal: gpuVramTotal, loraAdapters: res.models.flatMap(m => m.loraVersions.filter(v => v.isActive && m.inferencePort === 8001).map(v => ({ id: v.versionTag, name: v.versionTag, isActive: v.isActive, requestRate: vllmText?.running ? 25.5 : 0 }))) },
			{ port: 8002, type: "MULTIMODAL" as PortType, status: vllmMm?.running ? "ONLINE" : "OFFLINE", requestsPerSecond: vllmMm?.running ? 25.5 : 0, p50Latency: vllmMm?.running ? 120 : 0, vramUsed: vllmMm?.running ? (systemInfo?.gpu?.vram_used_gb ?? 0) : 0, vramTotal: gpuVramTotal, loraAdapters: res.models.flatMap(m => m.loraVersions.filter(v => v.isActive && m.inferencePort === 8002).map(v => ({ id: v.versionTag, name: v.versionTag, isActive: v.isActive, requestRate: vllmMm?.running ? 25.5 : 0 }))) },
		];
		return ports;
	}, () => delay(200).then(() => toApiResponse({ code: 200, message: "success", data: MOCK_INFERENCE_PORTS })));
}
