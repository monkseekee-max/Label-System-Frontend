import type { MenuItemType } from "#src/layout/layout-menu/types";
import type { AppRouteRecordRaw } from "#src/router/types";

import { ROOT_ROUTE_ID } from "#src/router/constants";
import { getRootRouteRuntime, getRouterRuntime } from "#src/router/runtime";
import { ascending } from "#src/router/utils/ascending";
import { flattenRoutes } from "#src/router/utils/flatten-routes";
import { generateMenuItemsFromRoutes } from "#src/router/utils/generate-menu-items-from-routes";

import { create } from "zustand";

interface AccessState {
	// 路由菜单
	wholeMenus: MenuItemType[]
	// 有权限的 React Router 路由
	routeList: AppRouteRecordRaw[]
	// 扁平化后的路由，路由 id 作为索引 key
	flatRouteList: Record<string, AppRouteRecordRaw>
	// 是否获取到权限
	isAccessChecked: boolean
}

function createAccessState(routes: AppRouteRecordRaw[], isAccessChecked = false): AccessState {
	return {
		wholeMenus: generateMenuItemsFromRoutes(routes),
		routeList: routes,
		flatRouteList: flattenRoutes(routes),
		isAccessChecked,
	};
}

let baseRouteSnapshot: AppRouteRecordRaw[] = [];

interface AccessAction {
	initializeBaseRoutes: (routes: AppRouteRecordRaw[]) => AccessState
	setAccessStore: (routes: AppRouteRecordRaw[]) => AccessState
	reset: () => void
};

export const useAccessStore = create<AccessState & AccessAction>(set => ({
	...createAccessState(baseRouteSnapshot),

	initializeBaseRoutes: (routes) => {
		baseRouteSnapshot = routes;
		const nextState = createAccessState(baseRouteSnapshot);
		set(state => state.isAccessChecked ? state : nextState);
		return nextState;
	},

	setAccessStore: (routes) => {
		const newRoutes = ascending([...baseRouteSnapshot, ...routes]);
		/* 添加新的路由到根路由 */
		getRouterRuntime().patchRoutes(ROOT_ROUTE_ID, routes);
		const flatRouteList = flattenRoutes(newRoutes);
		const wholeMenus = generateMenuItemsFromRoutes(newRoutes);
		const newState = {
			wholeMenus,
			routeList: newRoutes,
			flatRouteList,
			isAccessChecked: true,
		};
		set(() => newState);
		return newState;
	},

	reset: () => {
		/* 移除动态路由 */
		getRouterRuntime()._internalSetRoutes(getRootRouteRuntime());
		set(createAccessState(baseRouteSnapshot));
	},
}));
