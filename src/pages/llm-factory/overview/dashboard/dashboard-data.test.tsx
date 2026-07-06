/**
 * dashboard 派生数据构建器单测 (P2-10).
 * 锁住飞轮统计标签 + 流水线状态推导的退化/真实数据行为.
 */
import type { DashboardData } from "./dashboard-data";

import { describe, expect, it } from "vitest";

import { buildBottomStats, buildFlywheelStats, buildModules, buildTextPipelineSteps, MM_PIPELINE_STEPS } from "./dashboard-data";

const fullDash: DashboardData = {
	total_data: 54,
	active_lora: "lora_v123",
	flywheel: { annotations: 100, trainings: 5, models: 3, eval_pass_rate: 86, pending_review: 2 },
	infra: { vllm_text_port: 8001, vllm_mm_port: 8002 },
	recent_pipeline: [{ run_id: "r1", status: "completed", model_key: "qwen3-8b", final_loss: 1.23456 }],
};

describe("buildFlywheelStats", () => {
	it("真实数据 → 正确标签", () => {
		const stats = buildFlywheelStats(fullDash);
		expect(stats.map(s => s.label)).toEqual([
			"100 条",
			"5 次训练",
			"3 版本",
			":8001",
			"Pass 86%",
			"2 待审核",
		]);
		expect(stats.map(s => s.target)).toEqual(["data", "train", "model", "infer", "eval", "align"]);
	});

	it("无数据 → 退化默认值 (0 / 未启动)", () => {
		const stats = buildFlywheelStats(undefined);
		expect(stats.map(s => s.label)).toEqual([
			"0 条",
			"0 次训练",
			"0 版本",
			"未启动",
			"Pass 0%",
			"0 待审核",
		]);
	});

	it("infra 缺失 → 推理节点显示未启动", () => {
		const dash = { ...fullDash, infra: undefined };
		expect(buildFlywheelStats(dash).find(s => s.target === "infer")?.label).toBe("未启动");
	});
});

describe("buildBottomStats", () => {
	it("真实数据 → 正确值", () => {
		const stats = buildBottomStats(fullDash);
		expect(stats.map(s => s.value)).toEqual([":8001", ":8002", "54", "lora_v123", "86%"]);
	});

	it("无数据 → 退化 (未启动 / 0 / 无)", () => {
		const stats = buildBottomStats(undefined);
		expect(stats.map(s => s.value)).toEqual(["未启动", "未启动", "0", "无", "0%"]);
	});
});

describe("buildTextPipelineSteps", () => {
	it("无训练 → 全部 pending", () => {
		const steps = buildTextPipelineSteps(undefined);
		expect(steps.every(s => s.status === "pending")).toBe(true);
		expect(steps.map(s => s.label)).toContain("SFT 训练");
	});

	it("训练完成 → 前3步 completed, SFT completed, 部署 completed (有 active_lora)", () => {
		const steps = buildTextPipelineSteps(fullDash);
		expect(steps[0].status).toBe("completed"); // 数据摄入
		expect(steps[3].status).toBe("completed"); // SFT 训练 (lastStatus=completed)
		expect(steps[3].time).toBe("Loss 1.2346"); // final_loss 保留4位
		expect(steps[4].status).toBe("completed"); // 评测 (eval_pass_rate>0)
		expect(steps[5].status).toBe("completed"); // 部署 (active_lora)
	});

	it("训练 running → SFT 步骤 running", () => {
		const dash = { ...fullDash, recent_pipeline: [{ ...fullDash.recent_pipeline[0], status: "running" }] };
		expect(buildTextPipelineSteps(dash)[3].status).toBe("running");
	});

	it("final_loss 为 null → SFT time 为空", () => {
		const dash = { ...fullDash, recent_pipeline: [{ ...fullDash.recent_pipeline[0], final_loss: null }] };
		expect(buildTextPipelineSteps(dash)[3].time).toBe("");
	});

	it("eval_pass_rate 为 0 → 评测步骤 pending", () => {
		const dash = { ...fullDash, flywheel: { ...fullDash.flywheel, eval_pass_rate: 0 } };
		expect(buildTextPipelineSteps(dash)[4].status).toBe("pending");
	});
});

describe("mM_PIPELINE_STEPS", () => {
	it("固定 6 步全 pending 模板", () => {
		expect(MM_PIPELINE_STEPS).toHaveLength(6);
		expect(MM_PIPELINE_STEPS.every(s => s.status === "pending")).toBe(true);
	});
});

describe("buildModules", () => {
	it("真实数据 → stat 从 dash 派生", () => {
		const mods = buildModules(fullDash);
		const stat = Object.fromEntries(mods.map(m => [m.key, m.stat]));
		expect(stat.pipeline).toBe("54 条已入库");
		expect(stat.datasets).toBe("54 样本");
		expect(stat.training).toBe("5 次训练");
		expect(stat.models).toBe("3 版本");
		expect(stat.inference).toBe(":8001 :8002");
		expect(stat.eval).toBe("Pass 86%");
		expect(stat.alignment).toBe("2 待审核");
	});

	it("无数据 → 退化占位 (不再显示误导性假数字)", () => {
		const mods = buildModules(undefined);
		const stat = Object.fromEntries(mods.map(m => [m.key, m.stat]));
		expect(stat.pipeline).toBe("0 条已入库");
		expect(stat.training).toBe("0 次训练");
		expect(stat.inference).toBe("未启动");
		expect(stat.eval).toBe("Pass 0%");
		expect(stat.alignment).toBe("0 待审核");
	});

	it("infra 缺失 → 推理模块显示未启动", () => {
		const dash = { ...fullDash, infra: undefined };
		expect(buildModules(dash).find(m => m.key === "inference")?.stat).toBe("未启动");
	});

	it("模块数量与定义一致, 每个有 accent 与 link", () => {
		const mods = buildModules(fullDash);
		expect(mods).toHaveLength(10);
		expect(mods.every(m => !!m.accent && !!m.link && !!m.iconKey)).toBe(true);
	});
});
