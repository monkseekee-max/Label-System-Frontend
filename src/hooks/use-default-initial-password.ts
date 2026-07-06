import { fetchDefaultInitialPassword } from "#src/api/iam/default-password";
import { useQuery } from "@tanstack/react-query";

/**
 * 统一初始密码配置 hook.
 *
 * 启用 (enabled && password 非空) 时, 新增用户表单的密码框应为:
 *  - disabled (灰色)
 *  - 预填默认密码
 *  - 不可修改
 *
 * 关闭时, 表单恢复手动输入 + IAM 密码复杂度校验.
 *
 * 共享 queryKey, 任意一处保存后两处表单都会自动刷新.
 */
export function useDefaultInitialPassword() {
	return useQuery({
		queryKey: ["iam", "default-initial-password"],
		queryFn: () => fetchDefaultInitialPassword().then(r => r.result),
	});
}

/** 是否应使用统一初始密码 (启用且密码非空). */
export function useIsDefaultPasswordActive(): boolean {
	const { data } = useDefaultInitialPassword();
	return Boolean(data?.enabled && data.password);
}
