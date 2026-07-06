/**
 * data-annotation 纯逻辑单元测试 (P2-10 Phase A).
 *
 * 这些纯函数原本埋在 998 行组件里无法测试. 提取到 helpers.ts 后用测试锁住行为,
 * 为后续更深的 hook/子组件拆分提供安全网.
 */
import type { QAItem } from "#src/api/label-system";

import type { ImageSelection } from "./types";

import { describe, expect, it } from "vitest";
import {
	buildWindowSampleTimestamps,
	clamp,
	formatRegionLabel,
	formatTimestampTag,
	getRecommendation,
	hexToRgba,
	isPendingReview,
	isReviewedOk,
	previewText,
	statusColor,
} from "./helpers";

describe("status 分类", () => {
	it("isReviewedOk: 仅审核通过态为 true", () => {
		expect(isReviewedOk("reviewed_accept")).toBe(true);
		expect(isReviewedOk("reviewed_edit")).toBe(true);
		expect(isReviewedOk("green_auto_skip")).toBe(true);
		expect(isReviewedOk("approved")).toBe(true);
	});

	it("isReviewedOk: 非通过态 / 空 / 未定义为 false", () => {
		expect(isReviewedOk("pending_review")).toBe(false);
		expect(isReviewedOk("reviewed_reject")).toBe(false);
		expect(isReviewedOk(undefined)).toBe(false);
		expect(isReviewedOk("")).toBe(false);
	});

	it("isPendingReview: 仅待审态为 true", () => {
		expect(isPendingReview("pending_review")).toBe(true);
		expect(isPendingReview("orange_pending_review")).toBe(true);
		expect(isPendingReview("red_required_review")).toBe(true);
		expect(isPendingReview("approved")).toBe(false);
	});

	it("statusColor: 通过=绿 / 待审=橙 / 驳回=红 / 其他=蓝", () => {
		expect(statusColor("reviewed_accept")).toBe("green");
		expect(statusColor("orange_pending_review")).toBe("orange");
		expect(statusColor("reviewed_reject")).toBe("red");
		expect(statusColor("rejected")).toBe("red");
		expect(statusColor("generated")).toBe("blue");
		expect(statusColor(undefined)).toBe("blue");
	});
});

describe("clamp", () => {
	it("限制在 [min, max] 区间", () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-1, 0, 10)).toBe(0);
		expect(clamp(11, 0, 10)).toBe(10);
	});
});

describe("formatRegionLabel", () => {
	it("null 返回空串", () => {
		expect(formatRegionLabel(null)).toBe("");
	});

	it("输出归一化百分比坐标 (四舍五入)", () => {
		const sel: ImageSelection = {
			left: 0,
			top: 0,
			width: 0,
			height: 0,
			normalized: { x: 0.123, y: 0.456, width: 0.5, height: 0.789 },
		};
		expect(formatRegionLabel(sel)).toBe("x:12%,y:46%,w:50%,h:79%");
	});
});

describe("formatTimestampTag", () => {
	it("保留三位小数并加 s 后缀", () => {
		expect(formatTimestampTag(1.5)).toBe("1.500s");
		expect(formatTimestampTag(0)).toBe("0.000s");
	});
});

describe("buildWindowSampleTimestamps", () => {
	it("采样数被限制在 [2, 6]", () => {
		expect(buildWindowSampleTimestamps(0, 10, 1)).toHaveLength(2);
		expect(buildWindowSampleTimestamps(0, 10, 100)).toHaveLength(6);
	});

	it("两端包含 start 与 end, 均匀分布", () => {
		const ts = buildWindowSampleTimestamps(0, 10, 3);
		expect(ts[0]).toBe(0);
		expect(ts[ts.length - 1]).toBe(10);
		expect(ts).toHaveLength(3);
		expect(ts[1]).toBe(5);
	});

	it("start==end 时所有采样点相同", () => {
		const ts = buildWindowSampleTimestamps(4, 4, 3);
		expect(ts.every(t => t === 4)).toBe(true);
	});
});

describe("getRecommendation", () => {
	const base = { id: "x", score_bucket: "green" } as QAItem;

	it("null → 等待选择 (neutral)", () => {
		const r = getRecommendation(null);
		expect(r.tone).toBe("neutral");
		expect(r.label).toContain("等待");
	});

	it("已审核通过 → green", () => {
		expect(getRecommendation({ ...base, status: "approved" } as QAItem).tone).toBe("green");
	});

	it("待审 → blue", () => {
		expect(getRecommendation({ ...base, status: "pending_review" } as QAItem).tone).toBe("blue");
	});

	it("green 桶 → green (轻量抽检)", () => {
		expect(getRecommendation({ ...base, status: "generated", score_bucket: "green" } as QAItem).tone).toBe("green");
	});

	it("orange 桶 → orange", () => {
		expect(getRecommendation({ ...base, status: "generated", score_bucket: "orange" } as QAItem).tone).toBe("orange");
	});

	it("red 桶 → red (必须人工标注)", () => {
		expect(getRecommendation({ ...base, status: "generated", score_bucket: "red" } as QAItem).tone).toBe("red");
	});
});

describe("previewText", () => {
	it("取第一个非空值", () => {
		expect(previewText("", null, "hello")).toBe("hello");
	});

	it("超过 96 字符截断并加 …", () => {
		const long = "x".repeat(100);
		const out = previewText(long);
		expect(out.length).toBe(97); // 96 + …
		expect(out.endsWith("…")).toBe(true);
	});

	it("全部为空 → 默认提示", () => {
		expect(previewText("", null, undefined)).toContain("等待补充");
	});
});

describe("hexToRgba", () => {
	it("6位 hex 转换", () => {
		expect(hexToRgba("#1677ff", 0.18)).toBe("rgba(22, 119, 255, 0.18)");
	});

	it("3位 hex 展开为 6 位", () => {
		expect(hexToRgba("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
	});

	it("不带 # 也能解析", () => {
		expect(hexToRgba("000000", 1)).toBe("rgba(0, 0, 0, 1)");
	});

	it("alpha 越界钳制到 [0,1]", () => {
		expect(hexToRgba("#ff0000", 5)).toBe("rgba(255, 0, 0, 1)");
		expect(hexToRgba("#ff0000", -1)).toBe("rgba(255, 0, 0, 0)");
	});
});
