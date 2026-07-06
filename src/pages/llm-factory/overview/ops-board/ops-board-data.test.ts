/**
 * 运营看板派生数据单测 (锁住「真实数据派生」逻辑, 防回退到硬编码).
 *
 * 验证 deriveGpuSummary/deriveActivity/deriveServiceHealth/deriveTrainingSummary
 * 从真实后端响应正确派生展示对象, 且边界 (空数据/除零) 安全.
 */
import type { AuditLogRecord } from "#src/api/audit";
import type { GpuMetric, SystemInfo, TrainingDashboard } from "#src/api/llm-factory/ops-board";
import { deriveActivity, deriveGpuSummary, deriveServiceHealth, deriveTrainingSummary } from "#src/pages/llm-factory/overview/ops-board/ops-board-data";
import { describe, expect, it } from "vitest";

const sampleGpu: GpuMetric[] = [
	{ id: "GPU-0", name: "RTX 5090", utilization: 60, utilizationDisplay: "60%", vramUsed: 20, vramTotal: 24, temperature: 50, power: 100, status: "busy" },
	{ id: "GPU-1", name: "RTX 5090", utilization: 10, utilizationDisplay: "10%", vramUsed: 2, vramTotal: 24, temperature: 45, power: 50, status: "active" },
];

const sampleInfo: SystemInfo = {
	version: "2.0.0",
	deployment_mode: "single_gpu",
	gpu: { device: "RTX 5090", vram_total_gb: 25.7, vram_used_gb: 0.0 },
	vllm: {
		text: { running: true, port: 8001, pids: [1], models: ["qwen3-8b"] },
		multimodal: { running: false, port: 8002, pids: [], models: [] },
	},
	data: { total_annotations: 54 },
	lora: { active: "lora_v1", total_versions: 1 },
	eval: { total_completed: 21 },
	tasks: { running: 0, details: [] },
};

const sampleDash: TrainingDashboard = {
	total_data: 54,
	total_trainings: 5,
	active_lora: "lora_v1",
	flywheel: { annotations: 54, trainings: 5, models: 2, eval_pass_rate: 86, pending_review: 3 },
	summary: { total_trainings: 5, avg_loss: 0.42, avg_duration_seconds: 120, avg_peak_vram_gb: 16 },
	recent_pipeline: [],
	infra: { vllm_text_port: 8001, vllm_mm_port: 8002 },
};

describe("deriveGpuSummary: 真实 GPU 列表派生 (非硬编码 4 块)", () => {
	it("正常数据: 汇总显存/利用率/繁忙数", () => {
		const s = deriveGpuSummary(sampleGpu);
		expect(s.count).toBe(2);
		expect(s.totalVram).toBe(48);
		expect(s.usedVram).toBe(22);
		expect(s.busyCount).toBe(1);
		expect(s.freeRatio).toBe(45.8); // 22/48 ≈ 45.8%
	});

	it("空 GPU 列表: 安全返回零值", () => {
		const s = deriveGpuSummary([]);
		expect(s.count).toBe(0);
		expect(s.totalVram).toBe(0);
		expect(s.freeRatio).toBe(0);
	});
});

describe("deriveServiceHealth: 真实 vLLM running 状态", () => {
	it("文本在线/多模态离线 → 对应卡片状态", () => {
		const cards = deriveServiceHealth(sampleInfo);
		expect(cards).toHaveLength(3); // text + multimodal + training
		const text = cards.find(c => c.key === "vllm-text");
		expect(text?.healthy).toBe(true);
		expect(text?.port).toBe(8001);
		const mm = cards.find(c => c.key === "vllm-mm");
		expect(mm?.healthy).toBe(false); // multimodal running=false
		const train = cards.find(c => c.key === "training");
		expect(train?.detail).toContain("运行中任务: 0");
	});

	it("两者都离线 → 两卡都 down", () => {
		const down = { ...sampleInfo, vllm: { text: { running: false, port: 8001, pids: [], models: [] }, multimodal: { running: false, port: 8002, pids: [], models: [] } } };
		const cards = deriveServiceHealth(down);
		expect(cards.filter(c => c.healthy)).toHaveLength(1); // 仅 training 卡 (BFF 在线)
	});
});

describe("deriveActivity: 真实审计日志派生最近活动", () => {
	it("action 映射为可读中文 + 相对时间", () => {
		const logs: AuditLogRecord[] = [
			{ id: 1, companyId: 1, actor: "api", actorType: "machine", action: "data.export", resourceType: "annotation", resourceId: null, before: null, after: { count: 10, format: "jsonl" }, ip: null, userAgent: null, createdAt: new Date(Date.now() - 300000).toISOString() },
			{ id: 2, companyId: 1, actor: "api", actorType: "machine", action: "auto_mitigator.restart_vllm.started", resourceType: null, resourceId: null, before: null, after: null, ip: null, userAgent: null, createdAt: new Date(Date.now() - 7200000).toISOString() },
			{ id: 3, companyId: 1, actor: "api", actorType: "machine", action: "auto_mitigator.failing_action.failed", resourceType: null, resourceId: null, before: null, after: null, ip: null, userAgent: null, createdAt: new Date().toISOString() },
		];
		const acts = deriveActivity(logs);
		expect(acts).toHaveLength(3);
		expect(acts[0].message).toContain("导出标注数据");
		expect(acts[0].message).toContain("10 条");
		expect(acts[0].time).toBe("5 分钟前");
		expect(acts[1].message).toContain("vLLM 重启");
		expect(acts[1].time).toBe("2 小时前");
		// failed → error 类型
		expect(acts[2].type).toBe("error");
	});

	it("空日志 → 空数组", () => {
		expect(deriveActivity([])).toEqual([]);
	});
});

describe("deriveTrainingSummary: 真实训练看板汇总", () => {
	it("合并 dashboard + systemInfo → 训练产出", () => {
		const t = deriveTrainingSummary(sampleDash, sampleInfo);
		expect(t.totalTrainings).toBe(5);
		expect(t.totalModels).toBe(2);
		expect(t.avgLoss).toBe(0.42);
		expect(t.activeLora).toBe("lora_v1");
		expect(t.totalEvals).toBe(21);
		expect(t.totalAnnotations).toBe(54);
	});
});
