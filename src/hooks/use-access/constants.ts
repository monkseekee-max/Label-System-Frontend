import { FrontendRoles } from "#src/router/role-hierarchy";

/**
 * 统一管理权限常量，避免在项目中到处写死字符串，便于维护。
 */

/**
 * 按钮权限前缀
 */
export const permissionPrefix = "permission:button";

/**
 * 常见按钮权限：
 * - get: 获取
 * - update: 更新
 * - delete: 删除
 * - add: 新增
 */
export const accessControlCodes = {
	get: `${permissionPrefix}:get`,
	update: `${permissionPrefix}:update`,
	delete: `${permissionPrefix}:delete`,
	add: `${permissionPrefix}:add`,
};

export const AccessControlRoles = {
	superAdmin: FrontendRoles.superAdmin,
	admin: FrontendRoles.admin,
	annotator: FrontendRoles.annotator,
	dataTrainer: FrontendRoles.dataTrainer,
	reviewer: FrontendRoles.reviewer,
	// legacy names for compatibility
	legacyAdmin: FrontendRoles.superAdmin,
	common: FrontendRoles.annotator,
};
