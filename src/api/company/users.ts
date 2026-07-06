import type { BackendUserPosition, BackendUserRole } from "#src/api/user";
import type { FrontendUserResponse, UserStatus } from "#src/api/user/iam-user-mapping";
import { isSuccessResponse } from "#src/api/shared";
import { request } from "#src/utils/request";

export type { BackendUserPosition, BackendUserRole, UserStatus };
export type CompanyUserResponse = FrontendUserResponse;

export interface CreateUserRequest {
	createType: "COMPANY_USER"
	phone: string
	password: string
	username?: string
	realName?: string
	role: BackendUserRole
	position: BackendUserPosition
	companyCode?: string
}

export interface UpdateUserStatusRequest {
	status: UserStatus
}

export interface UpdateUserAssignmentRequest {
	role: BackendUserRole
	position: BackendUserPosition
}

interface RawResponse<T> {
	code: number
	message: string
	data: T
}

interface LabelUserRecord {
	userId: number
	phone: string
	username: string
	realName: string
	role: string
	position: string
	status: string
	companyId: number
	companyCode: string
	companyName: string
}

interface LabelUserList {
	records: LabelUserRecord[]
	total: number
}

function toApiResponse<T>(raw: RawResponse<T>): ApiResponse<T> {
	return {
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data,
	};
}

function mapLabelUser(u: LabelUserRecord): FrontendUserResponse {
	return {
		id: u.userId,
		userId: u.userId,
		companyId: u.companyId,
		companyCode: u.companyCode,
		companyName: u.companyName,
		phone: u.phone,
		email: u.phone,
		username: u.username,
		realName: u.realName,
		role: (u.role || "EMPLOYEE") as BackendUserRole,
		position: (u.position || "ANNOTATOR") as BackendUserPosition,
		status: (u.status === "ENABLED" ? "ENABLED" : "DISABLED") as UserStatus,
		mustChangePassword: false,
		iamRole: u.role || "operator",
		permissions: [],
	};
}

export interface UserListParams {
	companyName?: string
	realName?: string
	phone?: string
	status?: UserStatus
	position?: BackendUserPosition
	role?: BackendUserRole
}

// ADR-020/A1' 收敛: 用户管理直连 :9090 /api/users (真实 PG 用户 + 多租户隔离), 不再走 iam admin/users
export function fetchCompanyUsers(params?: UserListParams) {
	const searchParams: Record<string, string | number> = { pageNo: 1, pageSize: 100 };
	if (params?.realName || params?.phone) {
		searchParams.keyword = params?.realName || params?.phone || "";
	}
	if (params?.position) {
		searchParams.position = params.position;
	}
	return request.get("users", { searchParams }).json<RawResponse<LabelUserList>>().then((raw) => {
		let users = (raw.data?.records || []).map(mapLabelUser);
		if (params?.status) {
			users = users.filter(user => user.status === params.status);
		}
		if (params?.role) {
			users = users.filter(user => user.role === params.role);
		}
		return { code: 200, message: "success", success: true, result: users };
	});
}

export function createCompanyUser(data: CreateUserRequest) {
	return request.post("users", {
		json: {
			phone: data.phone,
			companyCode: data.companyCode || "",
			username: data.username || data.phone,
			password: data.password,
			realName: data.realName || "",
			role: data.role,
			position: data.position,
		},
	}).json<RawResponse<LabelUserRecord>>().then(raw => ({
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data ? mapLabelUser(raw.data) : null,
	}));
}

export function updateUserStatus(userId: string | number, data: UpdateUserStatusRequest) {
	return request.put(`users/${userId}/status`, { json: { status: data.status } })
		.json<RawResponse<LabelUserRecord>>()
		.then(raw => ({ code: raw.code, message: raw.message, success: isSuccessResponse(raw.code), result: raw.data ? mapLabelUser(raw.data) : null }));
}

export function updateUserAssignment(userId: string | number, data: UpdateUserAssignmentRequest) {
	return request.put(`users/${userId}/assignment`, { json: { role: data.role, position: data.position } })
		.json<RawResponse<LabelUserRecord>>()
		.then(raw => ({ code: raw.code, message: raw.message, success: isSuccessResponse(raw.code), result: raw.data ? mapLabelUser(raw.data) : null }));
}

export { toApiResponse };
