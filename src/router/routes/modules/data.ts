import type { AppRouteRecordRaw } from "#src/router/types";
import ContainerLayout from "#src/layout/container-layout";
import { data } from "#src/router/extra-info";
import { FrontendRoles } from "#src/router/role-hierarchy";
import {
	AppstoreOutlined,
	DashboardOutlined,
	DatabaseOutlined,
	ExportOutlined,
	ProfileOutlined,
} from "@ant-design/icons";
import { createElement, lazy } from "react";

// ② 数据 — 数据资产全生命周期: 概览 / 标注源资料 / 训练数据集 / 任务类型
// pathless 布局路由, 跨前缀聚合 /label-system /llm-factory 下的数据页面
const Dashboard = lazy(() => import("#src/pages/label-system/dashboard"));
const DataManagement = lazy(() => import("#src/pages/label-system/data-management"));
const DataAssetCenter = lazy(() => import("#src/pages/label-system/data-asset-center"));
const DataDatasets = lazy(() => import("#src/pages/llm-factory/data/datasets"));
const DataTaskTypes = lazy(() => import("#src/pages/llm-factory/data/task-types"));
const DataPipeline = lazy(() => import("#src/pages/llm-factory/data/pipeline"));
const DataMediaAssets = lazy(() => import("#src/pages/llm-factory/data/media-assets"));

const roles = [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer];

const routes: AppRouteRecordRaw[] = [
	{
		Component: ContainerLayout,
		handle: {
			order: data,
			menuKey: "cat-data",
			title: "数据",
			icon: createElement(DatabaseOutlined),
			roles,
		},
		children: [
			{
				path: "/label-system/dashboard",
				Component: Dashboard,
				handle: {
					title: "数据概览",
					icon: createElement(DashboardOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/label-system/data-management",
				Component: DataManagement,
				handle: {
					title: "标注数据",
					icon: createElement(AppstoreOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/label-system/data-asset-center",
				Component: DataAssetCenter,
				handle: {
					title: "数据资产中心",
					icon: createElement(ExportOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/data/datasets",
				Component: DataDatasets,
				handle: {
					title: "训练数据集",
					icon: createElement(DatabaseOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/data/task-types",
				Component: DataTaskTypes,
				handle: {
					title: "任务类型",
					icon: createElement(ProfileOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			// 以下为辅助页面, 暂不在菜单展示 (保留 URL 可达)
			{
				path: "/llm-factory/data/pipeline",
				Component: DataPipeline,
				handle: {
					title: "数据管道",
					hideInMenu: true,
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/data/media-assets",
				Component: DataMediaAssets,
				handle: {
					title: "媒体资产",
					hideInMenu: true,
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
		],
	},
];

export default routes;
