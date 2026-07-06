/**
 * 统一初始密码字段逻辑单测.
 *
 * 验证 resolvePasswordFieldState 在统一初始密码 启用/未启用 各状态下的派生:
 *  - 启用 (enabled && password 非空): active=true, 预填密码, rules=[] (免复杂度校验)
 *  - 未启用 / 密码空: active=false, rules=IAM_PASSWORD_RULES (可编辑 + 复杂度校验)
 *
 * 字段渲染 (disabled/initialValue) 由组件消费此状态, 逻辑在此锁定, 无需渲染 pro-components.
 */
import type { DefaultInitialPassword } from "#src/api/iam/default-password";
import { IAM_PASSWORD_RULES, resolvePasswordFieldState } from "#src/components/initial-password-field/logic";
import { describe, expect, it } from "vitest";

describe("resolvePasswordFieldState: 统一初始密码激活判定", () => {
	it("未配置 (undefined): 不激活, 使用 IAM 复杂度规则", () => {
		const s = resolvePasswordFieldState(undefined);
		expect(s.active).toBe(false);
		expect(s.password).toBe("");
		expect(s.rules).toBe(IAM_PASSWORD_RULES);
	});

	it("enabled=false: 不激活, 使用 IAM 复杂度规则", () => {
		const s = resolvePasswordFieldState({ enabled: false, password: "Demo@2026" });
		expect(s.active).toBe(false);
		expect(s.password).toBe("");
		expect(s.rules).toBe(IAM_PASSWORD_RULES);
	});

	it("enabled=true 但 password 空: 不激活 (密码必须非空)", () => {
		const s = resolvePasswordFieldState({ enabled: true, password: "" });
		expect(s.active).toBe(false);
		expect(s.rules).toBe(IAM_PASSWORD_RULES);
	});

	it("enabled=true 且 password 非空: 激活, 预填密码, 免复杂度校验 (rules=[])", () => {
		const s = resolvePasswordFieldState({ enabled: true, password: "Demo@2026" });
		expect(s.active).toBe(true);
		expect(s.password).toBe("Demo@2026");
		expect(s.rules).toEqual([]);
	});
});

describe("密码复杂度规则", () => {
	it("包含必填 + 复杂度两条规则", () => {
		expect(IAM_PASSWORD_RULES).toHaveLength(2);
		expect((IAM_PASSWORD_RULES[0] as { required?: boolean }).required).toBe(true);
		expect((IAM_PASSWORD_RULES[1] as { pattern?: RegExp }).pattern).toBeInstanceOf(RegExp);
	});

	it("复杂度正则匹配合法密码, 拒绝弱密码", () => {
		const pattern = (IAM_PASSWORD_RULES[1] as { pattern: RegExp }).pattern;
		expect(pattern.test("Demo@2026")).toBe(true); // 合法: 大小写+数字+特殊
		expect(pattern.test("12345678")).toBe(false); // 仅数字
		expect(pattern.test("abcdefgh")).toBe(false); // 仅小写
		expect(pattern.test("Short1!")).toBe(false); // 不足8位
	});
});

// 显式标注 DefaultInitialPassword 类型用于单测可读性 (避免 unused 警告)
export type _UsedType = DefaultInitialPassword;
