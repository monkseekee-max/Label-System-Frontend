/**
 * 构建产物 chunk 体积预算测试 (A1 antd chunk 优化 TDD)
 *
 * 目的: 防止第三方依赖膨胀退化, 保证分包策略 (vendor 与业务分离 + 懒加载) 持续有效.
 *
 * 优化成果 (2026-06-15):
 *   - 优化前: antd+业务混入单一 1548KB chunk, 首屏 ~2657KB, 改业务代码致 antd 缓存失效
 *   - 优化后: vendor-antd 独立(稳定缓存) + echarts/pro 懒加载(不进首屏), 首屏 ~1948KB (-27%)
 *   - 无 Circular chunk 警告 (antd 全生态合并消除内部循环依赖)
 *
 * 运行前提: 先 `npm run build` 生成 build/assets/
 * 运行: vitest run src/build/chunk-budget.test.ts
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ASSETS_DIR = join(process.cwd(), "build", "assets");

/** 读取所有 JS chunk 的体积 (raw KB) */
function getChunkSizes(): Array<{ name: string, kb: number }> {
	try {
		return readdirSync(ASSETS_DIR)
			.filter(f => f.endsWith(".js"))
			.map(name => ({ name, kb: Math.round(statSync(join(ASSETS_DIR, name)).size / 1024) }))
			.sort((a, b) => b.kb - a.kb);
	}
	catch {
		return []; // 构建产物不存在时返回空 (测试会明确报告)
	}
}

describe("构建产物 chunk 体积预算", () => {
	const chunks = getChunkSizes();

	it("build/assets 目录存在且有 JS 产物", () => {
		expect(chunks.length, "请先运行 npm run build 生成产物").toBeGreaterThan(0);
	});

	it("echarts 独立成 chunk (懒加载证据: 仅2页用, 不进首屏)", () => {
		// echarts ~1136KB, 必须独立分包让首屏不加载它 (路由懒加载时才按需拉取)
		const hasEchartsVendor = chunks.some(c => /vendor-echarts/.test(c.name));
		expect(hasEchartsVendor, "echarts 未独立分包, 会污染首屏或主业务 chunk").toBe(true);
	});

	it("pro-components 独立成 chunk (懒加载: 后台管理组件按需加载)", () => {
		const hasProVendor = chunks.some(c => /vendor-pro/.test(c.name));
		expect(hasProVendor, "pro-components 未独立分包").toBe(true);
	});

	it("react vendor 存在 (第三方库与业务代码分离的证据)", () => {
		const hasReactVendor = chunks.some(c => /vendor-react/.test(c.name));
		expect(hasReactVendor, "缺少 react vendor chunk, 分包策略可能退化").toBe(true);
	});

	it("antd vendor 存在且不超过 1450KB (防 antd 生态膨胀退化)", () => {
		// antd v6 全生态 (组件+rc底层+icons) 合并消除循环依赖, ~1390KB 是现实下限
		// 预算 1450KB: 留 60KB 余量, 超过说明 antd 引入了新的大依赖需审视
		const antdChunk = chunks.find(c => /vendor-antd/.test(c.name));
		expect(antdChunk, "缺少 vendor-antd chunk").toBeDefined();
		expect(antdChunk!.kb, `vendor-antd 膨胀到 ${antdChunk!.kb}KB`).toBeLessThan(1450);
	});

	it("无任何 chunk 超过 1550KB (绝对防退化基线, 高于原始 antd 1548KB)", () => {
		// 最终护栏: 任何单一 chunk 不应超过原始 antd chunk (1548KB) 的水平
		// echarts 1136KB (懒加载) 和 antd 1390KB (vendor) 都在此线内
		const oversized = chunks.filter(c => c.kb > 1550);
		expect(oversized, `退化! 超标 chunk: ${oversized.map(c => `${c.kb}KB ${c.name}`).join(", ")}`).toHaveLength(0);
	});
});
