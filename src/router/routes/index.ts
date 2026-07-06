import type { AppRouteRecordRaw, RouteFileModule } from "#src/router/types";

import { changePasswordPath, loginPath } from "#src/router/extra-info";
import { ascending } from "#src/router/utils/ascending";
import { mergeRouteModules } from "#src/router/utils/merge-route-modules";
import { traverseTreeValues } from "#src/utils/tree";
import { coreRoutes } from "./core";

// 外部路由文件 (排除 *.test.ts: 测试文件无 default export, 会被误当作空路由 {} 加载)
export const externalRouteFiles: RouteFileModule = import.meta.glob(["./external/**/*.ts", "!./external/**/*.test.ts"], { eager: true });
// 静态路由文件
export const staticRouteFiles: RouteFileModule = import.meta.glob(["./static/**/*.ts", "!./static/**/*.test.ts"], { eager: true });

/**
 * 后端动态路由文件
 * 重要: 必须排除 *.test.ts! 否则测试文件(无 default export)会被 glob 误当作路由模块,
 * mergeRouteModules 将其包装为空对象 {} (无 path/handle/children) 注入路由树,
 * 导致 React Router patchRoutes → isSameRoute 比较该 pathless 空路由时
 * `undefined.every()` 抛 TypeError, 触发 auth-guard catch → 全站跳 500.
 */
export const dynamicRouteFiles: RouteFileModule = import.meta.glob(["./modules/**/*.ts", "!./modules/**/*.test.ts"], { eager: true });

/**
 * 外部路由 1. 不进行权限校验， 2. 不会触发请求，例如用户信息接口
 * @example "privacy-policy", "terms-of-service" 等
 */
export const externalRoutes: AppRouteRecordRaw[] = mergeRouteModules(externalRouteFiles);

/** 动态路由 */
export const dynamicRoutes: AppRouteRecordRaw[] = mergeRouteModules(dynamicRouteFiles);

/** 静态路由 */
export const staticRoutes: AppRouteRecordRaw[] = mergeRouteModules(staticRouteFiles);

/**
 * 基本路由列表，由核心路由、外部路由组成，会一直存在系统中
 */
const baseRoutes = ascending([
	...coreRoutes,
	...externalRoutes,
]);

/** 权限路由列表，包含动态路由和静态路由 */
const accessRoutes = [
	...dynamicRoutes,
	...staticRoutes,
];

/**
 * 路由白名单 1. 不进行权限校验， 2. 不会触发请求，例如用户信息接口
 * @example "privacy-policy", "terms-of-service" 等
 */
const whiteRouteNames = [
	loginPath,
	changePasswordPath,
	"/landing",
	"/about",
	...traverseTreeValues(externalRoutes, route => route.path),
];

export {
	accessRoutes,
	baseRoutes,
	whiteRouteNames,
};
