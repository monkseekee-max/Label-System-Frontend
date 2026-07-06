import type { BackendUserPosition, BackendUserRole } from "#src/api/user";
import { FrontendRoles } from "./role-hierarchy";

/**
 * 独立权限配置文件：
 * 维护后端 role/position 到前端 roles 的映射关系
 */

const FRONTEND_ROLE_FALLBACK = [FrontendRoles.annotator];

const POSITION_ROLE_MAP: Partial<Record<BackendUserPosition, string[]>> = {
	SUPER_ADMIN: [FrontendRoles.superAdmin],
	ADMIN: [FrontendRoles.admin],
	ANNOTATOR: [FrontendRoles.annotator],
	DATA_TRAINER: [FrontendRoles.dataTrainer],
	REVIEWER: [FrontendRoles.reviewer],
};

const ROLE_ROLE_MAP: Partial<Record<BackendUserRole, string[]>> = {
	ENGINEER: [FrontendRoles.superAdmin],
	MANAGER: [FrontendRoles.admin],
	EMPLOYEE: [FrontendRoles.annotator],
};

export interface AuthIdentity {
	role?: BackendUserRole
	position?: BackendUserPosition
}

export function mapAuthIdentityToFrontendRoles(identity: AuthIdentity) {
	if (identity.position) {
		const positionRoles = POSITION_ROLE_MAP[identity.position];
		if (positionRoles?.length) {
			return positionRoles;
		}
	}

	if (identity.role) {
		const roleRoles = ROLE_ROLE_MAP[identity.role];
		if (roleRoles?.length) {
			return roleRoles;
		}
	}

	return [...FRONTEND_ROLE_FALLBACK];
}
