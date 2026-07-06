import type { AppRouteRecordRaw } from "#src/router/types";

import ContainerLayout from "#src/layout/container-layout";
import { demo } from "#src/router/extra-info";
import { FrontendRoles } from "#src/router/role-hierarchy";
import { ExperimentOutlined } from "@ant-design/icons";
import { createElement, lazy } from "react";

const ImageAnnotationDemo = lazy(() => import("#src/pages/demo/image-annotation"));

const routes: AppRouteRecordRaw[] = [
	{
		path: "/demo",
		Component: ContainerLayout,
		handle: {
			order: demo,
			title: "Demo",
			icon: createElement(ExperimentOutlined),
			roles: [FrontendRoles.superAdmin],
			hideInMenu: true,
		},
		children: [
			{
				path: "/demo/image-annotation",
				Component: ImageAnnotationDemo,
				handle: {
					title: "Image Annotation Viewer",
					hideInMenu: true,
				},
			},
		],
	},
];

export default routes;
