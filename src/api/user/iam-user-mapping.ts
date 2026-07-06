import type { BackendUserPosition, BackendUserRole } from "./types";

export type FrontendUserId = string | number;
export type UserStatus = "ENABLED" | "DISABLED";

export interface IamUserResponse {
	id: string
	username: string
	email?: string | null
	role: string
	is_active: boolean
	company_id?: number
	created_at?: string | null
	permissions?: string[]
}

export interface FrontendUserResponse {
	id: FrontendUserId
	userId: FrontendUserId
	companyId: number
	companyCode: string
	companyName: string
	phone: string
	email: string
	username: string | null
	realName: string
	role: BackendUserRole
	position: BackendUserPosition
	status: UserStatus
	mustChangePassword: boolean
	createdAt?: string
	updatedAt?: string
	iamRole: string
	permissions: string[]
}

export interface IamCreateUserInput {
	email?: string
	password?: string
	username?: string
	realName?: string
	phone?: string
	role?: BackendUserRole
	position?: BackendUserPosition
	status?: UserStatus
	isActive?: boolean
}

export interface IamCreateUserPayload {
	username: string
	email: string
	password: string
	role: string
	is_active: boolean
}

export function mapIamUserToFrontendUser(user: IamUserResponse): FrontendUserResponse {
	const email = user.email ?? "";
	const username = user.username || email || user.id;
	const createdAt = user.created_at ?? undefined;

	return {
		id: user.id,
		userId: user.id,
		companyId: user.company_id ?? 0,
		companyCode: "",
		companyName: "",
		phone: email,
		email,
		username,
		realName: username,
		role: mapIamRoleToBackendRole(user.role),
		position: mapIamRoleToBackendPosition(user.role),
		status: user.is_active ? "ENABLED" : "DISABLED",
		mustChangePassword: false,
		createdAt,
		updatedAt: createdAt,
		iamRole: user.role,
		permissions: user.permissions ?? [],
	};
}

export function mapIamRoleToBackendRole(role?: string): BackendUserRole {
	switch (role) {
		case "admin":
		case "reviewer":
			return "ENGINEER";
		case "operator":
		default:
			return "EMPLOYEE";
	}
}

export function mapIamRoleToBackendPosition(role?: string): BackendUserPosition {
	switch (role) {
		case "admin":
			return "SUPER_ADMIN";
		case "reviewer":
			return "REVIEWER";
		case "operator":
		default:
			return "ANNOTATOR";
	}
}

export function mapBackendIdentityToIamRole(role?: BackendUserRole, position?: BackendUserPosition): string {
	if (position === "SUPER_ADMIN" || position === "ADMIN" || role === "ENGINEER" || role === "MANAGER") {
		return "admin";
	}
	if (position === "REVIEWER") {
		return "reviewer";
	}
	return "operator";
}

export function mapUserStatusToIamActive(status: UserStatus): boolean {
	return status === "ENABLED";
}

export function mapFrontendUserToIamCreatePayload(input: IamCreateUserInput): IamCreateUserPayload {
	const email = (input.email || input.phone || "").trim();
	const username = (input.username || input.realName || email.split("@")[0] || "").trim();

	return {
		username,
		email,
		password: input.password ?? "",
		role: mapBackendIdentityToIamRole(input.role, input.position),
		is_active: input.isActive ?? (input.status ? mapUserStatusToIamActive(input.status) : true),
	};
}
