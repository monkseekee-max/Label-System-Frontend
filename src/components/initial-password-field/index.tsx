import { resolvePasswordFieldState } from "#src/components/initial-password-field/logic";
import { useDefaultInitialPassword } from "#src/hooks/use-default-initial-password";
import { ProFormText } from "@ant-design/pro-components";
import { useMemo } from "react";

export { IAM_PASSWORD_RULES } from "#src/components/initial-password-field/logic";

/**
 * 新增用户表单的「初始密码」字段.
 *
 * 当统一初始密码启用 (enabled && password 非空) 时:
 *  - 字段 disabled (灰色), 预填统一密码, 不可修改, 免去每次手填.
 * 否则: 正常可编辑 + IAM 密码复杂度校验.
 *
 * 用法: <InitialPasswordField /> (等价于原 <ProFormText.Password name="password" .../>).
 */
export function InitialPasswordField({ name = "password" }: { name?: string } = {}) {
	const { data } = useDefaultInitialPassword();
	const state = useMemo(() => resolvePasswordFieldState(data), [data]);

	return (
		<ProFormText.Password
			name={name}
			label="初始密码"
			placeholder={state.active ? "已使用统一初始密码（系统自动填入）" : "请输入初始密码"}
			tooltip={state.active ? "已启用统一初始密码，由超管在「人员管理」中统一设置，此处不可修改" : undefined}
			initialValue={state.active ? state.password : undefined}
			rules={state.rules}
			fieldProps={state.active ? { disabled: true } : {}}
		/>
	);
}
