import type { AppRouteRecordRaw } from "#src/router/types";

import { addRouteIdByPath } from "#src/router/utils/add-route-id-by-path";

import { lazy } from "react";
import authRoutes from "./auth";
import exceptionRoutes from "./exception";

import fallbackRoute from "./fallback";

const LandingPage = lazy(() => import("#src/pages/landing"));

/** 公共官网路由 (无需登录) */
const publicRoutes: AppRouteRecordRaw[] = [
	{
		path: "/landing",
		Component: LandingPage,
		handle: {
			title: "Landing",
			hideInMenu: true,
		},
	},
];

/** 核心路由 */
export const coreRoutes: AppRouteRecordRaw[] = [
	...addRouteIdByPath([...authRoutes, ...exceptionRoutes, ...publicRoutes]),
	...fallbackRoute,
];
