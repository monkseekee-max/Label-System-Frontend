/**
 * GPU 监控告警派生单测.
 * 锁住 deriveGpuAlerts 的阈值规则 (高温/显存/空闲), 防止回退到硬编码.
 */
import type { GPUMetric } from "./gpu-data";

import { describe, expect, it } from "vitest";

import { deriveGpuAlerts } from "./gpu-data";

function gpu(over: Partial<GPUMetric>): GPUMetric {
	return {
		id: "GPU-0",
		name: "RTX 5090 #0",
		utilization: 40,
		vramUsed: 10,
		vramTotal: 24,
		temperature: 60,
		power: 200,
		utilizationDisplay: "40%",
		task: "task-x",
		status: "busy",
		temperaturePercent: 67,
		...over,
	};
}

describe("deriveGpuAlerts", () => {
	it("温度 ≥ 85°C → danger", () => {
		const alerts = deriveGpuAlerts([gpu({ temperature: 88 })]);
		expect(alerts.some(a => a.type === "danger" && a.message.includes("88") && a.message.includes("85"))).toBe(true);
	});

	it("温度 75-84°C → warn (非 danger)", () => {
		const alerts = deriveGpuAlerts([gpu({ temperature: 78 })]);
		const tempAlerts = alerts.filter(a => a.message.includes("温度"));
		expect(tempAlerts.length).toBe(1);
		expect(tempAlerts[0]!.type).toBe("warn");
	});

	it("显存使用率 ≥ 90% → warn", () => {
		const alerts = deriveGpuAlerts([gpu({ vramUsed: 22, vramTotal: 24 })]); // 91.6%
		expect(alerts.some(a => a.type === "warn" && a.message.includes("92%") && a.message.includes("接近上限"))).toBe(true);
	});

	it("空闲 GPU → info 提示", () => {
		const alerts = deriveGpuAlerts([gpu({ utilization: 3, status: "idle" })]);
		expect(alerts.some(a => a.type === "info" && a.message.includes("空闲"))).toBe(true);
	});

	it("正常 GPU (低负载但非 idle) → 不产生空闲告警", () => {
		// utilization < 50 但 status="busy" → 不算空闲告警 (与后端 status 判定一致)
		const alerts = deriveGpuAlerts([gpu({ utilization: 30, status: "busy", temperature: 50, vramUsed: 5 })]);
		expect(alerts.some(a => a.type === "info")).toBe(false);
	});

	it("完全正常的 GPU → 零告警", () => {
		const alerts = deriveGpuAlerts([gpu({ temperature: 50, vramUsed: 5, vramTotal: 24, utilization: 60, status: "busy" })]);
		expect(alerts).toHaveLength(0);
	});

	it("多 GPU 各自独立派生告警", () => {
		const alerts = deriveGpuAlerts([
			gpu({ id: "GPU-0", temperature: 90 }), // danger
			gpu({ id: "GPU-1", temperature: 50, vramUsed: 5, utilization: 60, status: "busy" }), // 正常
			gpu({ id: "GPU-2", utilization: 2, status: "idle" }), // info
		]);
		expect(alerts).toHaveLength(2); // GPU-0 danger + GPU-2 info, GPU-1 无
		expect(alerts.every(a => a.id.startsWith("GPU-"))).toBe(true);
	});

	it("空 GPU 列表 → 零告警", () => {
		expect(deriveGpuAlerts([])).toEqual([]);
	});
});
