import type { AppRouteRecordRaw } from "#src/router/types";

import { $t } from "#src/locales";
import { changePasswordPath, loginPath } from "#src/router/extra-info";

import { lazy } from "react";

const Login = lazy(() => import("#src/pages/login"));
const ChangePassword = lazy(() => import("#src/pages/change-password"));

const routes: AppRouteRecordRaw[] = [
	{
		path: loginPath,
		Component: Login,
		handle: {
			hideInMenu: true,
			title: $t("authority.login"),
		},
	},
	{
		path: changePasswordPath,
		Component: ChangePassword,
		handle: {
			hideInMenu: true,
			title: "修改密码",
		},
	},
];

export default routes;
