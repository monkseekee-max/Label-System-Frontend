import type { AppRouteRecordRaw } from "#src/router/types";
import ContainerLayout from "#src/layout/container-layout";
import ParentLayout from "#src/layout/parent-layout";
import { enterprise } from "#src/router/extra-info";
import { FrontendRoles } from "#src/router/role-hierarchy";
import {
	BankOutlined,
	DashboardOutlined,
	ToolOutlined,
} from "@ant-design/icons";
import { createElement, lazy } from "react";

// ① 企业 — 平台治理: 组织 / 配置 / 运维
// pathless 布局路由 (无 path), 跨前缀聚合 /platform /system /llm-factory 下的治理页面
// 注: 企业管理员/人员管理/系统配置/计费中心已整合进「企业管理」页面内部 (Tabs), 不再单独挂菜单。
const Companies = lazy(() => import("#src/pages/platform/companies"));
const OverviewDashboard = lazy(() => import("#src/pages/llm-factory/overview/dashboard"));
const InfraScheduler = lazy(() => import("#src/pages/llm-factory/infra/scheduler"));
const InfraGpuMonitor = lazy(() => import("#src/pages/llm-factory/infra/gpu-monitor"));
const AdminAuditLogs = lazy(() => import("#src/pages/llm-factory/admin/audit-logs"));
const AdminMachineTokens = lazy(() => import("#src/pages/llm-factory/admin/machine-tokens"));
const AdminObservability = lazy(() => import("#src/pages/llm-factory/admin/observability"));

// 分类父级须为后代角色并集 (filterTree 父级不过则整棵子树被丢弃)
const roles = [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.dataTrainer];

const routes: AppRouteRecordRaw[] = [
	{
		// pathless: 无 path, 仅作菜单分组 + 布局外壳 (React Router 布局路由模式)
		Component: ContainerLayout,
		handle: {
			order: enterprise,
			menuKey: "cat-enterprise",
			title: "企业",
			icon: createElement(BankOutlined),
			roles,
		},
		children: [
			{
				path: "/platform/companies",
				Component: Companies,
				handle: {
					title: "企业管理",
					icon: createElement(BankOutlined),
					roles: [FrontendRoles.superAdmin],
					permissions: ["permission:button:add", "permission:button:update", "permission:button:delete"],
				},
			},
			// 企业管理员 / 人员管理 / 系统配置 / 计费中心 已整合进企业管理页面 (/platform/companies) 的 Tabs
			{
				path: "/llm-factory/overview/dashboard",
				Component: OverviewDashboard,
				handle: {
					title: "平台概览",
					icon: createElement(DashboardOutlined),
					roles: [FrontendRoles.admin, FrontendRoles.dataTrainer],
				},
			},
			// 运维与安全 (pathless 子分组, 合并了原「基础设施」: 调度器 / GPU 监控)
			{
				Component: ParentLayout,
				handle: {
					menuKey: "grp-enterprise-admin",
					title: "运维与安全",
					icon: createElement(ToolOutlined),
					// 父级 roles = 后代角色并集 (含原基础设施的 dataTrainer, 否则 dataTrainer 看不到调度器 / GPU 监控)
					roles,
				},
				children: [
					// ——— 原「基础设施」 ———
					{
						path: "/llm-factory/infra/scheduler",
						Component: InfraScheduler,
						handle: { title: "调度器", roles: [FrontendRoles.admin, FrontendRoles.dataTrainer] },
					},
					{
						path: "/llm-factory/infra/gpu-monitor",
						Component: InfraGpuMonitor,
						handle: { title: "GPU 监控", roles: [FrontendRoles.admin, FrontendRoles.dataTrainer] },
					},
					// ——— 原运维与安全 ———
					{
						path: "/llm-factory/admin/audit-logs",
						Component: AdminAuditLogs,
						handle: { title: "审计日志", roles: [FrontendRoles.admin] },
					},
					{
						path: "/llm-factory/admin/machine-tokens",
						Component: AdminMachineTokens,
						handle: { title: "机器 Token", roles: [FrontendRoles.admin] },
					},
					{
						path: "/llm-factory/admin/observability",
						Component: AdminObservability,
						handle: { title: "SLO 可观测性", roles: [FrontendRoles.admin] },
					},
				],
			},
		],
	},
];

export default routes;
