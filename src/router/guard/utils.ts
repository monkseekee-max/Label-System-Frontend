import type { AppRouteRecordRaw } from "#src/router/types";
import { hasAnyRole } from "#src/router/role-hierarchy";

export function removeDuplicateRoutes(routes: AppRouteRecordRaw[]) {
	const pathSet = new Set<string>();
	return routes.filter((route) => {
		// pathless 布局路由 (无 path, 仅用于菜单分组如五大业务分类) 不参与去重:
		// 它们没有 URL, 各自是独立分组节点, 靠自身身份区分而非 path。
		if (!route.path) {
			return true;
		}
		if (pathSet.has(route.path)) {
			if (import.meta.env.DEV) {
				console.warn(`[auth-guard]: Duplicate route path: ${route.path}`);
			}
			return false;
		}
		pathSet.add(route.path);
		return true;
	});
}

export function hasRouteAccessByRoles(userRoles: string[], routeRoles?: string[]) {
	if (!routeRoles || routeRoles.length === 0) {
		return true;
	}
	return hasAnyRole(userRoles, routeRoles);
}
