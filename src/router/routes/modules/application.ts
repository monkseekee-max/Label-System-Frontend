import type { AppRouteRecordRaw } from "#src/router/types";
import ContainerLayout from "#src/layout/container-layout";
import { application } from "#src/router/extra-info";
import { FrontendRoles } from "#src/router/role-hierarchy";
import {
	AppstoreOutlined,
	MessageOutlined,
	ThunderboltOutlined,
} from "@ant-design/icons";
import { createElement, lazy } from "react";

// ⑤ 应用 — 模型服务化 + 业务应用: 推理服务 / 智能问答
// pathless 布局路由, 聚合 /llm-factory 下的应用层页面
// 注: 运营看板已集成进首页 (/home) Tabs, 此处不再单独提供菜单入口
const ModelInference = lazy(() => import("#src/pages/llm-factory/model/inference"));
const KnowledgeChat = lazy(() => import("#src/pages/llm-factory/knowledge/chat"));

const roles = [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer];

const routes: AppRouteRecordRaw[] = [
	{
		Component: ContainerLayout,
		handle: {
			order: application,
			menuKey: "cat-application",
			title: "应用",
			icon: createElement(AppstoreOutlined),
			roles,
		},
		children: [
			{
				path: "/llm-factory/model/inference",
				Component: ModelInference,
				handle: {
					title: "推理服务",
					icon: createElement(ThunderboltOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/knowledge/chat",
				Component: KnowledgeChat,
				handle: {
					title: "智能问答",
					icon: createElement(MessageOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
		],
	},
];

export default routes;
