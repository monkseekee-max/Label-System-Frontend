import type { AppRouteRecordRaw } from "#src/router/types";

export interface AuthType {
	token: string
	refreshToken: string
}

export interface LoginInfo {
	phone: string
	companyCode: string
	password: string
}

export type BackendUserRole = "EMPLOYEE" | "MANAGER" | "ENGINEER";
export type BackendUserPosition = "ANNOTATOR" | "DATA_TRAINER" | "REVIEWER" | "ADMIN" | "SUPER_ADMIN";

export interface CompanyOptionResponse {
	companyId: number
	companyCode: string
	companyName: string
}

export interface LoginResponse {
	token: string
	company: CompanyOptionResponse
	phone: string
	username?: string | null
	realName: string
	role: BackendUserRole
	position: BackendUserPosition
	mustChangePassword: boolean
}

export interface CurrentUserResponse {
	userId: number
	companyId: number
	companyCode: string
	companyName: string
	phone: string
	username?: string | null
	realName: string
	role: BackendUserRole
	position: BackendUserPosition
	mustChangePassword: boolean
}

export interface UserInfoType {
	id: string | number
	avatar: string
	username: string
	email: string
	phoneNumber: string
	description: string
	roles: Array<string>
	companyId?: number
	companyCode?: string
	companyName?: string
	phone?: string
	realName?: string
	role?: BackendUserRole
	position?: BackendUserPosition
	mustChangePassword?: boolean
	// 路由可以在此处动态添加
	menus?: AppRouteRecordRaw[]
}

export interface AuthListProps {
	label: string
	name: string
	auth: string[]
}
