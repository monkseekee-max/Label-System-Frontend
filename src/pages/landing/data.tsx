import type * as React from "react";
import {
	CloudServerOutlined,
	DatabaseOutlined,
	ExperimentOutlined,
	RocketOutlined,
	SafetyCertificateOutlined,
	SyncOutlined,
	ThunderboltOutlined,
} from "@ant-design/icons";

import { DatasetIcon, EditIcon, EvalIcon, InferIcon, LoopIcon, TrainIcon } from "./icons";

/* ------------------------------------------------------------------ *
 * Design tokens — one cohesive, restrained palette around brand blue.
 * ------------------------------------------------------------------ */
export const C = {
	brand: "#4F46E5",
	brandDark: "#3730A3",
	brandSoft: "#EEF2FF",
	ink: "#0F172A",
	ink2: "#1E293B",
	muted: "#64748B",
	mutedSoft: "#94A3B8",
	line: "#E2E8F0",
	bg: "#FFFFFF",
	bgSoft: "#F8FAFC",
	bgTint: "#F1F5F9",
	accent: "#06B6D4",
	success: "#10B981",
	violet: "#8B5CF6",
};

export const FONT = "'Inter','PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

export interface Feature {
	icon: React.ReactNode
	title: string
	desc: string
}

export const FEATURES: Feature[] = [
	{
		icon: <SyncOutlined />,
		title: "数据飞轮闭环",
		desc: "标注 → 数据集 → 训练 → 推理 → 评测 → 回流标注，全链路血缘可追溯，模型越用越准。",
	},
	{
		icon: <ExperimentOutlined />,
		title: "LoRA 高效微调",
		desc: "Qwen3-8B 基座 + LoRA 适配器，单卡 18 步完成领域适配，峰值显存仅 17.5G。",
	},
	{
		icon: <ThunderboltOutlined />,
		title: "vLLM 极速推理",
		desc: "vLLM 引擎 + LoRA 热加载，毫秒级响应，生产级吞吐，P50 延迟 86ms。",
	},
	{
		icon: <SafetyCertificateOutlined />,
		title: "质量门禁",
		desc: "自动评测 + 置信度分桶 + 人工对齐，三重质量保障，数据质量可控可信。",
	},
	{
		icon: <RocketOutlined />,
		title: "模型生命周期",
		desc: "training → staging → prod，Git 风格版本管理、灰度发布与一键回滚。",
	},
	{
		icon: <CloudServerOutlined />,
		title: "三平面架构",
		desc: "数据 / 计算 / 应用三平面解耦，笔记本友好，服务器可迁移，架构零改动。",
	},
];

export const STATS = [
	{ value: "26+", label: "标注资产" },
	{ value: "47", label: "训练数据" },
	{ value: "17.5G", label: "峰值显存" },
	{ value: "754", label: "单元测试" },
];

export const FLYWHEEL_STEPS = [
	{ label: "标注", icon: <EditIcon />, desc: "多模态标注" },
	{ label: "数据集", icon: <DatasetIcon />, desc: "ShareGPT 构建" },
	{ label: "训练", icon: <TrainIcon />, desc: "LoRA 微调" },
	{ label: "推理", icon: <InferIcon />, desc: "vLLM 部署" },
	{ label: "评测", icon: <EvalIcon />, desc: "自动门禁" },
	{ label: "回流", icon: <LoopIcon />, desc: "纠错驱动" },
];

export const WORKFLOW_STEPS = [
	{
		title: "01 · 数据导入",
		desc: "PDF / Word / 图片 / 视频多模态资产统一入库，自动清洗去重，血缘落库。",
	},
	{
		title: "02 · 智能标注",
		desc: "双模型预标 + 人工校对，置信度分桶路由，标注效率提升 5×。",
	},
	{
		title: "03 · 训练飞轮",
		desc: "审核通过的 QA 自动汇集为数据集，触发 LoRA SFT 增量训练。",
	},
	{
		title: "04 · 部署评测",
		desc: "vLLM 热加载上线，黄金题集回归 + 线上纠错回流，闭环进化。",
	},
];

export const TERMINAL_LINES = [
	{ p: "$", t: "llamafactory-cli train configs/qwen3-lora.yaml", c: C.success },
	{ p: "✓", t: "加载 Qwen3-8B 基座模型 (bf16)", c: C.mutedSoft },
	{ p: "✓", t: "注入 LoRA 适配器 (r=16, alpha=32)", c: C.mutedSoft },
	{ p: "►", t: "训练中 18/18 steps  [████████████] 100%", c: C.brand },
	{ p: "✓", t: "loss: 0.8421 → 0.2103  · 显存 17.5G / 24G", c: "#E6A23C" },
	{ p: "$", t: "vllm serve --lora-modules domain=adapter_v3", c: C.success },
	{ p: "✓", t: "INFO: Uvicorn running on http://0.0.0.0:8000", c: C.mutedSoft },
	{ p: "►", t: "LoRA 热加载完成 · P50 延迟 86ms", c: C.brand },
];

export const ARCH_LAYERS = [
	{
		name: "应用平面",
		icon: <RocketOutlined />,
		items: ["标注工作台", "训练管线", "模型中心", "智能引擎"],
	},
	{
		name: "计算平面",
		icon: <ThunderboltOutlined />,
		items: ["LoRA 微调", "vLLM 推理", "GPU 调度", "质量门禁"],
	},
	{
		name: "数据平面",
		icon: <DatabaseOutlined />,
		items: ["多模态资产", "数据集构建", "血缘追溯", "PG 持久化"],
	},
];

export const WHY_ROWS = [
	"端到端数据飞轮 (标注→训练→部署→回流)",
	"多模态标注 (文本 / 图片框选 / 视频抽帧)",
	"双模型预标 + 语义验证质量门禁",
	"vLLM 生产级推理 + LoRA 热加载",
	"零云依赖，笔记本即可全流程跑通",
	"754 单元测试 + ADR 架构治理",
];

export const FAQ_ITEMS = [
	{
		key: "1",
		label: "需要什么硬件配置？",
		children: "笔记本模式仅需 16GB 内存即可跑通全流程（CPU 推理）；完整训练推荐单张 RTX 4090 / A100 24G+，本项目实测 Qwen3-8B LoRA 峰值显存仅 17.5G。",
	},
	{
		key: "2",
		label: "支持哪些模型和数据格式？",
		children: "基座支持 Qwen3 / Llama / Mistral 等 LLaMA-Factory 兼容模型；数据支持文本 QA、图片框选、视频抽帧三模态，自动转换为 ShareGPT 训练格式。",
	},
	{
		key: "3",
		label: "如何保证标注与训练质量？",
		children: "内置三重质量保障：①双模型预标交叉投票 ②语义验证器（embedding 蕴含判定）③黄金题集回归 + 线上纠错回流，数据飞轮越转越准。",
	},
	{
		key: "4",
		label: "可以脱离云服务本地部署吗？",
		children: "可以。三平面架构（应用 / 计算 / 数据）完全解耦，全部组件可本地运行，零云依赖；亦支持无缝迁移到 GPU 服务器集群。",
	},
];

export const NAV_LINKS = [
	{ label: "核心能力", href: "#features" },
	{ label: "工作流", href: "#workflow" },
	{ label: "架构", href: "#architecture" },
	{ label: "常见问题", href: "#faq" },
];
