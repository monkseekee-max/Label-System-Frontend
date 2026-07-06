// dashboard 派生数据构建器 (P2-10: 从 index.tsx 提取, 纯函数可测)
import type { ReactNode } from "react";

import { IconBolt, IconChart, IconCheckCircle, IconDatabase, IconFolder, IconImage, IconList, IconMonitor, IconPackage, IconRefresh, IconRocket } from "./icons";

export interface DashboardData {
	total_data: number
	active_lora: string | null
	flywheel: {
		annotations: number
		trainings: number
		models: number
		eval_pass_rate: number
		pending_review: number
	}
	infra?: { vllm_text_port: number, vllm_mm_port: number }
	recent_pipeline: Array<{
		run_id: string
		status: string
		model_key: string
		final_loss: number | null
	}>
}

/** 飞轮节点统计 (真实数据, 退化默认值) */
export function buildFlywheelStats(dash?: DashboardData) {
	const fw = dash?.flywheel;
	const infra = dash?.infra;
	return [
		{ label: `${fw?.annotations ?? 0} 条`, target: "data" },
		{ label: `${fw?.trainings ?? 0} 次训练`, target: "train" },
		{ label: `${fw?.models ?? 0} 版本`, target: "model" },
		{ label: infra ? `:${infra.vllm_text_port}` : "未启动", target: "infer" },
		{ label: `Pass ${fw?.eval_pass_rate ?? 0}%`, target: "eval" },
		{ label: `${fw?.pending_review ?? 0} 待审核`, target: "align" },
	];
}

/** 底部状态 (真实数据) */
export function buildBottomStats(dash?: DashboardData) {
	const fw = dash?.flywheel;
	const infra = dash?.infra;
	return [
		{ icon: <IconCheckCircle />, label: "文本推理", value: infra ? `:${infra.vllm_text_port}` : "未启动" },
		{ icon: <IconCheckCircle />, label: "多模态推理", value: infra ? `:${infra.vllm_mm_port}` : "未启动" },
		{ icon: <IconDatabase />, label: "标注总量", value: `${dash?.total_data ?? 0}` },
		{ icon: <IconPackage />, label: "活跃LoRA", value: dash?.active_lora ?? "无" },
		{ icon: <IconRefresh />, label: "评测通过率", value: `${fw?.eval_pass_rate ?? 0}%` },
	];
}

/** 文本流水线步骤 (状态基于真实训练推导) */
export function buildTextPipelineSteps(dash?: DashboardData) {
	const fw = dash?.flywheel;
	const recentPipeline = dash?.recent_pipeline ?? [];
	const hasTraining = recentPipeline.length > 0;
	const lastRun = recentPipeline[0];
	const lastStatus = lastRun?.status;
	return [
		{ label: "数据摄入", time: "", status: hasTraining ? "completed" : "pending" },
		{ label: "标注", time: "", status: hasTraining ? "completed" : "pending" },
		{ label: "质量过滤", time: "", status: hasTraining ? "completed" : "pending" },
		{ label: "SFT 训练", time: lastRun?.final_loss != null ? `Loss ${lastRun.final_loss.toFixed(4)}` : "", status: lastStatus === "completed" ? "completed" : lastStatus === "running" ? "running" : "pending" },
		{ label: "评测", time: "", status: (fw?.eval_pass_rate ?? 0) > 0 ? "completed" : "pending" },
		{ label: "部署", time: "", status: dash?.active_lora ? "completed" : "pending" },
	];
}

/** 多模态流水线步骤 (固定 pending 模板) */
export const MM_PIPELINE_STEPS = [
	{ label: "媒体上传", time: "", status: "pending" },
	{ label: "多模标注", time: "", status: "pending" },
	{ label: "质量过滤", time: "", status: "pending" },
	{ label: "PEFT 训练", time: "", status: "pending" },
	{ label: "评测", time: "", status: "pending" },
	{ label: "部署", time: "", status: "pending" },
];

/** 飞轮节点图标映射 */
export const FLYWHEEL_NODE_ICONS: Record<string, ReactNode> = {
	data: <IconDatabase />,
	train: <IconBolt />,
	model: <IconPackage />,
	infer: <IconRocket />,
	eval: <IconChart />,
	align: <IconRefresh />,
};

/** 模块卡片图标映射 */
export const MODULE_ICONS: Record<string, ReactNode> = {
	"数据管道": <IconDatabase />,
	"数据集管理": <IconFolder />,
	"训练任务": <IconBolt />,
	"模型管理": <IconPackage />,
	"推理服务": <IconRocket />,
	"评测中心": <IconChart />,
	"专家对齐": <IconRefresh />,
	"媒体资源": <IconImage />,
	"任务类型": <IconList />,
	"GPU 监控": <IconMonitor />,
};

/** 模块强调色语义 (映射到 antd 派生色 token, 亮/暗主题自动适配) */
export type ModuleAccent = "primary" | "success" | "warning" | "info" | "error";

export interface DashboardModule {
	key: string
	title: string
	desc: string
	link: string
	iconKey: string
	accent: ModuleAccent
	stat: string
}

/** 模块静态定义 (标题/描述/链接/图标key/强调色); stat 由 buildModules 从真实数据派生 */
const MODULE_DEFS: Array<Omit<DashboardModule, "stat">> = [
	{ key: "pipeline", title: "数据管道", desc: "3 大摄入入口，自动化清洗转换", link: "/llm-factory/data/pipeline", iconKey: "数据管道", accent: "success" },
	{ key: "datasets", title: "数据集管理", desc: "版本控制、质量分布、DVC 追踪", link: "/llm-factory/data/datasets", iconKey: "数据集管理", accent: "success" },
	{ key: "training", title: "训练任务", desc: "7 步流水线，双轨道并行训练", link: "/llm-factory/model/training", iconKey: "训练任务", accent: "primary" },
	{ key: "models", title: "模型管理", desc: "LoRA 版本管理，VRAM 预算分配", link: "/llm-factory/model/models", iconKey: "模型管理", accent: "primary" },
	{ key: "inference", title: "推理服务", desc: "双端口推理服务，LoRA 热插拔", link: "/llm-factory/model/inference", iconKey: "推理服务", accent: "info" },
	{ key: "eval", title: "评测中心", desc: "多任务指标，质量门禁 PASS/FAIL", link: "/llm-factory/quality/eval-center", iconKey: "评测中心", accent: "warning" },
	{ key: "alignment", title: "专家对齐", desc: "反馈审核，SFT 修正触发", link: "/llm-factory/quality/alignment", iconKey: "专家对齐", accent: "warning" },
	{ key: "media", title: "媒体资源", desc: "图像/视频上传，任务类型关联", link: "/llm-factory/data/media-assets", iconKey: "媒体资源", accent: "success" },
	{ key: "task-types", title: "任务类型", desc: "6 种任务类型，5 套标注模板", link: "/llm-factory/data/task-types", iconKey: "任务类型", accent: "primary" },
	{ key: "gpu", title: "GPU 监控", desc: "显存分配、温度监控、资源隔离", link: "/llm-factory/infra/gpu-monitor", iconKey: "GPU 监控", accent: "error" },
];

/** 模块卡片 (真实数据派生 stat; 退化显示占位而非误导性假数字) */
export function buildModules(dash?: DashboardData): DashboardModule[] {
	const fw = dash?.flywheel;
	const infra = dash?.infra;
	const statByKey: Record<string, string> = {
		"pipeline": `${dash?.total_data ?? 0} 条已入库`,
		"datasets": `${dash?.total_data ?? 0} 样本`,
		"training": `${fw?.trainings ?? 0} 次训练`,
		"models": `${fw?.models ?? 0} 版本`,
		"inference": infra ? `:${infra.vllm_text_port} :${infra.vllm_mm_port}` : "未启动",
		"eval": `Pass ${fw?.eval_pass_rate ?? 0}%`,
		"alignment": `${fw?.pending_review ?? 0} 待审核`,
		"media": "图像 / 视频",
		"task-types": "多类型模板",
		"gpu": "显存监控",
	};
	return MODULE_DEFS.map(def => ({ ...def, stat: statByKey[def.key] ?? "—" }));
}
