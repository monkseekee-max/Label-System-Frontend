/**
 * ADR-019 P3-1: lifecycle UI 纯函数单元测试
 *
 * 覆盖 lifecycle-ui.ts 的三类纯函数:
 *   - lifecycleStateColor: 状态 → antd Tag 颜色 (含 fallback)
 *   - lifecycleStateLabel: 状态 → 中文标签
 *   - isValidLifecycleAction: (state, action) → 是否允许 (对齐 src/compute/model_lifecycle.py 状态机)
 */
import { describe, expect, it } from "vitest";

import {
	isValidLifecycleAction,
	lifecycleStateColor,
	lifecycleStateLabel,
} from "./lifecycle-ui";

describe("lifecycleStateColor", () => {
	it("prod → success (绿色, 突出生产)", () => {
		expect(lifecycleStateColor("prod")).toBe("success");
	});

	it("staging → gold (待评测, 警示色)", () => {
		expect(lifecycleStateColor("staging")).toBe("gold");
	});

	it("training → blue (进行中)", () => {
		expect(lifecycleStateColor("training")).toBe("blue");
	});

	it("archived → default (中性灰, 已归档)", () => {
		expect(lifecycleStateColor("archived")).toBe("default");
	});

	it("superseded → default (被取代, 不再活跃)", () => {
		expect(lifecycleStateColor("superseded")).toBe("default");
	});

	it("discarded → error (废弃, 红色)", () => {
		expect(lifecycleStateColor("discarded")).toBe("error");
	});

	it("rejected → error (拒绝, 红色)", () => {
		expect(lifecycleStateColor("rejected")).toBe("error");
	});

	it("未知状态 → default fallback", () => {
		expect(lifecycleStateColor("unknown" as any)).toBe("default");
	});
});

describe("lifecycleStateLabel", () => {
	it("prod → 生产", () => {
		expect(lifecycleStateLabel("prod")).toBe("生产");
	});

	it("staging → 待评测", () => {
		expect(lifecycleStateLabel("staging")).toBe("待评测");
	});

	it("training → 训练中", () => {
		expect(lifecycleStateLabel("training")).toBe("训练中");
	});

	it("archived → 已归档", () => {
		expect(lifecycleStateLabel("archived")).toBe("已归档");
	});

	it("superseded → 已取代", () => {
		expect(lifecycleStateLabel("superseded")).toBe("已取代");
	});

	it("discarded → 已废弃", () => {
		expect(lifecycleStateLabel("discarded")).toBe("已废弃");
	});

	it("rejected → 已拒绝", () => {
		expect(lifecycleStateLabel("rejected")).toBe("已拒绝");
	});
});

describe("isValidLifecycleAction", () => {
	describe("promote (staging → prod, 需 gate=pass)", () => {
		it("staging 允许 promote", () => {
			expect(isValidLifecycleAction("staging", "promote")).toBe(true);
		});

		it("training 不允许 promote (必须先到 staging)", () => {
			expect(isValidLifecycleAction("training", "promote")).toBe(false);
		});

		it("prod 不允许 promote (已在生产)", () => {
			expect(isValidLifecycleAction("prod", "promote")).toBe(false);
		});

		it("archived 不允许 promote (终态)", () => {
			expect(isValidLifecycleAction("archived", "promote")).toBe(false);
		});
	});

	describe("archive (多数状态可归档)", () => {
		it("staging 允许 archive", () => {
			expect(isValidLifecycleAction("staging", "archive")).toBe(true);
		});

		it("prod 允许 archive (生产下线)", () => {
			expect(isValidLifecycleAction("prod", "archive")).toBe(true);
		});

		it("superseded 允许 archive (取代后归档)", () => {
			expect(isValidLifecycleAction("superseded", "archive")).toBe(true);
		});

		it("rejected 允许 archive (拒绝后归档保留)", () => {
			expect(isValidLifecycleAction("rejected", "archive")).toBe(true);
		});

		it("archived 不允许 archive (已是终态)", () => {
			expect(isValidLifecycleAction("archived", "archive")).toBe(false);
		});

		it("discarded 不允许 archive (已是终态)", () => {
			expect(isValidLifecycleAction("discarded", "archive")).toBe(false);
		});
	});

	describe("discard (训练废弃, 仅 training 允许)", () => {
		it("training 允许 discard", () => {
			expect(isValidLifecycleAction("training", "discard")).toBe(true);
		});

		it("staging 不允许 discard (走 archive 或 reject)", () => {
			expect(isValidLifecycleAction("staging", "discard")).toBe(false);
		});

		it("prod 不允许 discard", () => {
			expect(isValidLifecycleAction("prod", "discard")).toBe(false);
		});
	});

	describe("未知 action", () => {
		it("未知 action 一律拒绝", () => {
			expect(isValidLifecycleAction("prod", "unknownAction" as any)).toBe(false);
		});
	});
});
