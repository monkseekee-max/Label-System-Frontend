import type { DefaultInitialPassword } from "#src/api/iam/default-password";

/** IAM 密码复杂度: 至少 8 位, 含大小写字母、数字、特殊字符. */
export const IAM_PASSWORD_RULES = [
	{ required: true, message: "请输入初始密码" },
	{
		pattern: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/,
		message: "至少8位，需包含大小写字母、数字和特殊字符",
	},
];

export interface PasswordFieldState {
	/** 是否处于「统一初始密码已激活」状态: 启用且密码非空. */
	active: boolean
	/** 统一密码 (激活时预填, 否则空). */
	password: string
	/** 校验规则: 激活时为空数组 (免校验), 否则 IAM 复杂度规则. */
	rules: typeof IAM_PASSWORD_RULES | []
}

/**
 * 由统一初始密码配置派生字段状态 (纯函数, 便于单测).
 *
 * 激活 (enabled && password 非空): 字段 disabled + 预填 + 免校验.
 * 否则: 可编辑 + IAM 密码复杂度校验.
 */
export function resolvePasswordFieldState(data?: DefaultInitialPassword): PasswordFieldState {
	const active = Boolean(data?.enabled && data?.password);
	return {
		active,
		password: active ? (data?.password ?? "") : "",
		rules: active ? [] : IAM_PASSWORD_RULES,
	};
}
