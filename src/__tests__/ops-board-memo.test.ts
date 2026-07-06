import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 审计整改 M10 (2026-06-20): 运营看板图表记忆化.
// 2026-06-30 更新: 假的 Training Loss 曲线 (lossChartOption) 已移除, 改为真实训练产出汇总;
// createGaugeOption 改为 useMemo (每块真实 GPU 各自一个 option). 记忆化约束仍适用.

describe("ops-board chart memoization (审计整改 M10)", () => {
	const file = resolve(__dirname, "../pages/llm-factory/overview/ops-board/ops-board-view.tsx");
	const source = readFileSync(file, "utf-8");

	it("createGaugeOption 必须 useMemo 包装 (每块真实 GPU 各自 option, 避免每次渲染重建)", () => {
		expect(source).toMatch(/createGaugeOption\s*=\s*useMemo/);
	});

	it("派生数据必须用 useMemo 包装 (activities/services/gpuSummary 等, 纯函数派生避免重算)", () => {
		expect(source).toMatch(/useMemo\(\(\)\s*=>\s*deriveActivity/);
		expect(source).toMatch(/useMemo\(\(\)\s*=>\s*deriveGpuSummary/);
	});

	it("reactECharts 应通过 notMerge, 避免不必要重画", () => {
		expect(source).toMatch(/notMerge/);
	});

	it("不再有硬编码的 lossChartOption 假曲线 (已替换为真实训练产出)", () => {
		expect(source).not.toMatch(/lossChartOption\s*=\s*useMemo/);
		expect(source).not.toMatch(/Qwen3-8B \(text_qa\)/); // 旧假曲线图例
	});
});
