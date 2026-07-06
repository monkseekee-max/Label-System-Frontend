import type { AppRouteRecordRaw } from "#src/router/types";
import type { AuthType, CompanyOptionResponse, CurrentUserResponse, LoginInfo, LoginResponse, UserInfoType } from "./types";

import { isSuccessResponse } from "#src/api/shared";
import { mapAuthIdentityToFrontendRoles } from "#src/router/permission-mapping";
import { request } from "#src/utils/request";
import { REFRESH_TOKEN_PATH } from "#src/utils/request/constants";

export * from "./types";

interface AuthApiResponse<T> {
	code: number
	message: string
	data: T
}

function toApiResponse<T>(raw: AuthApiResponse<T>): ApiResponse<T> {
	return {
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data,
	};
}

function ensureSuccess<T>(raw: AuthApiResponse<T>) {
	if (!isSuccessResponse(raw.code)) {
		throw new Error(raw.message || "Request failed");
	}
	return raw.data;
}

export function fetchLogin(data: LoginInfo) {
	return request.post("auth/login", { json: data }).json<AuthApiResponse<LoginResponse>>().then((raw) => {
		const result = ensureSuccess(raw);
		return toApiResponse<AuthType & { mustChangePassword: boolean, position?: string, companyCode?: string }>({
			...raw,
			data: {
				token: result.token,
				refreshToken: (result as { refresh_token?: string }).refresh_token ?? "",
				mustChangePassword: result.mustChangePassword,
				position: (result as { position?: string }).position,
				companyCode: (result as { companyCode?: string }).companyCode,
			},
		});
	});
}

export function fetchLogout() {
	return request.post("auth/logout").json<AuthApiResponse<Record<string, never>>>().then(toApiResponse);
}

export function fetchLoginCompanies(data: { phone: string }) {
	return request.get("auth/companies", { searchParams: data, ignoreLoading: true }).json<AuthApiResponse<CompanyOptionResponse[]>>().then((raw) => {
		ensureSuccess(raw);
		return toApiResponse(raw);
	});
}

export function fetchAsyncRoutes() {
	return request.get("get-async-routes").json<ApiResponse<AppRouteRecordRaw[]>>();
}

export interface RegisterInfo {
	phone: string
	companyCode: string
	username: string
	password: string
	realName?: string
}

export interface RegisterResponse {
	userId: number
	username: string
	phone: string
	realName: string
	companyCode: string
	companyName: string
	role: string
	position: string
}

/** 注册 (ADR-016 生产级) */
export function fetchRegister(data: RegisterInfo) {
	return request
		.post("auth/register", { json: data })
		.json<AuthApiResponse<RegisterResponse>>()
		.then((raw) => {
			ensureSuccess(raw);
			return toApiResponse(raw);
		});
}

/** 获取可注册的公司列表 */
export function fetchRegisterCompanies() {
	return request
		.get("auth/companies", { searchParams: { phone: "" } })
		.json<AuthApiResponse<CompanyOptionResponse[]>>()
		.then((raw) => {
			ensureSuccess(raw);
			return toApiResponse(raw);
		});
}

export function fetchUserInfo() {
	return request.get("auth/me").json<AuthApiResponse<CurrentUserResponse>>().then((raw) => {
		const result = ensureSuccess(raw);
		const mappedUserInfo: UserInfoType = {
			id: result.userId,
			avatar: "",
			username: result.username || result.realName || result.phone,
			email: "",
			phoneNumber: result.phone,
			description: result.realName || "",
			roles: mapAuthIdentityToFrontendRoles({
				role: result.role,
				position: result.position,
			}),
			companyId: result.companyId,
			companyCode: result.companyCode,
			companyName: result.companyName,
			phone: result.phone,
			realName: result.realName,
			role: result.role,
			position: result.position,
		};
		return toApiResponse({
			...raw,
			data: mappedUserInfo,
		});
	});
}

export interface RefreshTokenResult {
	token: string
	refreshToken: string
}

export function fetchRefreshToken(data: { readonly refreshToken: string }) {
	return request.post(REFRESH_TOKEN_PATH, { json: data }).json<AuthApiResponse<{ token: string, access_token: string, refresh_token: string }>>().then((raw) => {
		const result = ensureSuccess(raw);
		// AUTH-D1 (ADR-021): 后端返回 snake_case, 映射为前端 RefreshTokenResult
		return {
			code: raw.code,
			message: raw.message,
			success: isSuccessResponse(raw.code),
			result: {
				token: result.token || result.access_token,
				refreshToken: result.refresh_token,
			},
		} as ApiResponse<RefreshTokenResult>;
	});
}

export interface ChangePasswordRequest {
	oldPassword: string
	newPassword: string
	confirmPassword: string
}

export function changePassword(data: ChangePasswordRequest) {
	return request.post("auth/change-password", { json: data }).json<AuthApiResponse<void>>().then((raw) => {
		ensureSuccess(raw);
		return toApiResponse(raw);
	});
}
