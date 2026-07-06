import type { AppRouteRecordRaw } from "#src/router/types";

import { lazy } from "react";

const NotFound = lazy(() => import("#src/pages/exception/404"));

// 通过中间常量赋值, 避免 id 字段在 AppRouteRecordRaw (Omit 了 id) 上的 excess-property 报错;
// fallback 是特殊的 404 兜底路由, 需手动固定 id
const entry = {
	path: "*",
	id: "404",
	Component: NotFound,
	handle: {
		title: "404",
		hideInMenu: true,
	},
};

const routes: AppRouteRecordRaw[] = [entry];

export default routes;
