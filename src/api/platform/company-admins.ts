import type { BackendUserPosition, BackendUserRole } from "#src/api/user";
import type { FrontendUserResponse, UserStatus } from "#src/api/user/iam-user-mapping";
import type { CompanyResponse } from "./companies";
import { isSuccessResponse } from "#src/api/shared";
import { mapBackendIdentityToIamRole, mapFrontendUserToIamCreatePayload, mapIamUserToFrontendUser, mapUserStatusToIamActive } from "#src/api/user/iam-user-mapping";
import { request } from "#src/utils/request";

export type { BackendUserPosition, BackendUserRole, UserStatus };
export type UserResponse = FrontendUserResponse;

export interface CreateCompanyAdminRequest {
	companyId: number
	email: string
	password: string
	phone?: string
	username?: string
	realName?: string
	role: "MANAGER" | "ENGINEER"
}

export interface CreateSystemAdminRequest {
	email: string
	password: string
	phone?: string
	username?: string
	realName?: string
}

export interface UpdateAdminStatusRequest {
	status: UserStatus
}

interface RawResponse<T> {
	code: number
	message: string
	data: T
}

interface IamListResponse {
	items: Parameters<typeof mapIamUserToFrontendUser>[0][]
}

function toApiResponse<T>(raw: RawResponse<T>): ApiResponse<T> {
	return {
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data,
	};
}

function toSuccessResponse<T>(data: T, message = "success"): ApiResponse<T> {
	return {
		code: 200,
		message,
		success: true,
		result: data,
	};
}

function isAdminUser(user: UserResponse) {
	return user.position === "ADMIN" || user.position === "SUPER_ADMIN" || user.iamRole === "admin";
}

export function fetchCompanyAdmins(companyId: number) {
	return fetchAllCompanyAdmins().then(response => ({
		...response,
		result: response.result.filter(user => user.companyId === companyId),
	}));
}

export function fetchAllCompanyAdmins() {
	return request.get("admin/users").json<IamListResponse>().then((raw) => {
		const admins = raw.items.map(mapIamUserToFrontendUser).filter(isAdminUser);
		return toSuccessResponse(admins);
	});
}

export function createCompanyAdmin(data: CreateCompanyAdminRequest) {
	return request.post("admin/users", {
		json: mapFrontendUserToIamCreatePayload({
			...data,
			role: data.role,
			position: "ADMIN",
		}),
	})
		.json<Parameters<typeof mapIamUserToFrontendUser>[0]>()
		.then(user => toSuccessResponse(mapIamUserToFrontendUser(user), "创建成功"));
}

export function createSystemAdmin(data: CreateSystemAdminRequest) {
	return request.post("admin/users", {
		json: {
			...mapFrontendUserToIamCreatePayload({ ...data, role: "ENGINEER", position: "SUPER_ADMIN" }),
			role: mapBackendIdentityToIamRole("ENGINEER", "SUPER_ADMIN"),
		},
	})
		.json<Parameters<typeof mapIamUserToFrontendUser>[0]>()
		.then(user => toSuccessResponse(mapIamUserToFrontendUser(user), "创建成功"));
}

export function updateAdminStatus(userId: string | number, data: UpdateAdminStatusRequest) {
	return request.patch(`admin/users/${userId}/status`, { json: { is_active: mapUserStatusToIamActive(data.status) } })
		.json<Parameters<typeof mapIamUserToFrontendUser>[0]>()
		.then(user => toSuccessResponse(mapIamUserToFrontendUser(user), "更新成功"));
}

export type { CompanyResponse };
export { toApiResponse };
