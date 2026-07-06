import type { AppRouteRecordRaw } from "#src/router/types";
import ContainerLayout from "#src/layout/container-layout";
import { training } from "#src/router/extra-info";
import { FrontendRoles } from "#src/router/role-hierarchy";
import {
	CloudServerOutlined,
	RocketOutlined,
} from "@ant-design/icons";
import { createElement, lazy } from "react";

// ④ 训练 — 训练任务 + 模型仓库: 训练管线 / 训练任务 / 模型仓库 / 模型中心
// pathless 布局路由, 跨前缀聚合 /label-system /llm-factory 下的训练与模型页面
const TrainingPipeline = lazy(() => import("#src/pages/label-system/training-pipeline"));
const ModelTraining = lazy(() => import("#src/pages/llm-factory/model/training"));
const ModelModels = lazy(() => import("#src/pages/llm-factory/model/models"));
const ModelHub = lazy(() => import("#src/pages/label-system/model-hub"));

const roles = [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer];

const routes: AppRouteRecordRaw[] = [
	{
		Component: ContainerLayout,
		handle: {
			order: training,
			menuKey: "cat-training",
			title: "训练",
			icon: createElement(RocketOutlined),
			roles,
		},
		children: [
			{
				path: "/label-system/training-pipeline",
				Component: TrainingPipeline,
				handle: {
					title: "训练管线",
					icon: createElement(RocketOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/model/training",
				Component: ModelTraining,
				handle: {
					title: "训练任务",
					icon: createElement(RocketOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/model/training/create",
				Component: lazy(() => import("#src/pages/llm-factory/model/training/create")),
				handle: {
					title: "创建训练任务",
					hideInMenu: true,
					currentActiveMenu: "/llm-factory/model/training",
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/model/training/:id",
				Component: lazy(() => import("#src/pages/llm-factory/model/training/detail")),
				handle: {
					title: "训练详情",
					hideInMenu: true,
					currentActiveMenu: "/llm-factory/model/training",
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/model/models",
				Component: ModelModels,
				handle: {
					title: "模型仓库",
					icon: createElement(CloudServerOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/label-system/model-hub",
				Component: ModelHub,
				handle: {
					title: "模型中心",
					icon: createElement(CloudServerOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
		],
	},
];

export default routes;
