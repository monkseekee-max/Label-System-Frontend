import type { AppRouteRecordRaw } from "#src/router/types";
import ContainerLayout from "#src/layout/container-layout";
import { annotation } from "#src/router/extra-info";
import { FrontendRoles } from "#src/router/role-hierarchy";
import {
	AimOutlined,
	ApiOutlined,
	EditOutlined,
	SafetyCertificateOutlined,
} from "@ant-design/icons";
import { createElement, lazy } from "react";

// ③ 标注 — 标注生产 + 质量引擎: 工作台 / 智能引擎 / 质量评估 / 对齐
// pathless 布局路由, 跨前缀聚合 /label-system /llm-factory 下的标注相关页面
const DataAnnotation = lazy(() => import("#src/pages/label-system/data-annotation"));
const IntelligenceHub = lazy(() => import("#src/pages/label-system/intelligence"));
const QualityEvalCenter = lazy(() => import("#src/pages/llm-factory/quality/eval-center"));
const QualityAlignment = lazy(() => import("#src/pages/llm-factory/quality/alignment"));

// 分类父级须为后代角色并集 (含 annotator/reviewer: 标注员/审核员是标注系统核心用户, 否则看不到任何标注页)
const roles = [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.annotator, FrontendRoles.reviewer, FrontendRoles.dataTrainer];

const routes: AppRouteRecordRaw[] = [
	{
		Component: ContainerLayout,
		handle: {
			order: annotation,
			menuKey: "cat-annotation",
			title: "标注",
			icon: createElement(EditOutlined),
			roles,
		},
		children: [
			{
				path: "/label-system/data-annotation",
				Component: DataAnnotation,
				handle: {
					title: "标注工作台",
					icon: createElement(EditOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.annotator, FrontendRoles.reviewer],
				},
			},
			{
				path: "/label-system/intelligence",
				Component: IntelligenceHub,
				handle: {
					title: "智能引擎",
					icon: createElement(ApiOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.annotator, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/quality/eval-center",
				Component: QualityEvalCenter,
				handle: {
					title: "质量评估",
					icon: createElement(SafetyCertificateOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.reviewer, FrontendRoles.dataTrainer],
				},
			},
			{
				path: "/llm-factory/quality/alignment",
				Component: QualityAlignment,
				handle: {
					title: "对齐分析",
					icon: createElement(AimOutlined),
					roles: [FrontendRoles.superAdmin, FrontendRoles.admin, FrontendRoles.reviewer, FrontendRoles.dataTrainer],
				},
			},
		],
	},
];

export default routes;
