import { isSuccessResponse } from "#src/api/shared";
import { request } from "#src/utils/request";

/** 统一初始密码配置: 启用后, 新增用户表单的密码框变灰、预填、不可改. */
export interface DefaultInitialPassword {
	/** 是否启用统一初始密码. 关闭则各表单恢复手动输入. */
	enabled: boolean
	/** 统一初始密码明文 (需满足 IAM 密码复杂度: 8 位含大小写字母/数字/特殊字符). */
	password: string
}

interface RawResponse<T> {
	code: number
	message: string
	data: T
}

function toApiResponse<T>(raw: RawResponse<T>): ApiResponse<T> {
	return {
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data,
	};
}

/** 读取统一初始密码配置 (GET /api/iam/default-password). */
export function fetchDefaultInitialPassword() {
	return request.get("iam/default-password").json<RawResponse<DefaultInitialPassword>>().then(toApiResponse);
}

/** 保存统一初始密码配置 (PUT /api/iam/default-password, 需 admin). */
export function saveDefaultInitialPassword(data: DefaultInitialPassword) {
	return request.put("iam/default-password", { json: data }).json<RawResponse<DefaultInitialPassword>>().then(toApiResponse);
}
