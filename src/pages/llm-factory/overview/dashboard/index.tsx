import type { ReactNode } from "react";
import type { DashboardData, DashboardModule, ModuleAccent } from "./dashboard-data";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { request } from "#src/utils/request";
import { useQuery } from "@tanstack/react-query";
import { Tag, Typography } from "antd";

import { useNavigate } from "react-router";
import { buildBottomStats, buildFlywheelStats, buildModules, buildTextPipelineSteps, FLYWHEEL_NODE_ICONS as flywheelNodeIcons, MM_PIPELINE_STEPS as mmPipelineSteps, MODULE_ICONS as moduleIcons } from "./dashboard-data";
import { IconGear } from "./icons";

const { Text } = Typography;

// 飞轮节点路由 (固定导航映射)
const FLYWHEEL_ROUTES: Record<string, string> = {
	data: "/llm-factory/data/pipeline",
	train: "/llm-factory/model/training",
	model: "/llm-factory/model/models",
	infer: "/llm-factory/model/inference",
	eval: "/llm-factory/quality/eval-center",
	align: "/llm-factory/quality/alignment",
};

// 飞轮节点配色 (深色 hero 内的跨主题品牌色, 与 CHART_COLORS 一致)
const FLYWHEEL_NODE_CONFIG: Record<string, { bg: string, border: string, color: string }> = {
	data: { bg: "rgba(15,198,194,0.15)", border: CHART_COLORS.cyan, color: CHART_COLORS.cyan },
	train: { bg: "rgba(22,93,255,0.15)", border: CHART_COLORS.primary, color: CHART_COLORS.primary },
	model: { bg: "rgba(47,84,235,0.15)", border: CHART_COLORS.blue, color: CHART_COLORS.blue },
	infer: { bg: "rgba(52,145,250,0.15)", border: "#3491FA", color: CHART_COLORS.primary },
	eval: { bg: "rgba(89,126,247,0.15)", border: CHART_COLORS.indigo, color: CHART_COLORS.indigo },
	align: { bg: "rgba(22,93,255,0.15)", border: CHART_COLORS.primary, color: CHART_COLORS.primary },
};

const FLYWHEEL_NODE_POSITIONS = [
	{ top: "8%", left: "18%" },
	{ top: "8%", left: "56%" },
	{ top: "30%", right: "8%" },
	{ bottom: "8%", right: "12%" },
	{ bottom: "8%", left: "36%" },
	{ top: "38%", left: "4%" },
];

const FLYWHEEL_LEGEND = [
	{ dot: CHART_COLORS.cyan, label: "数据流" },
	{ dot: CHART_COLORS.primary, label: "训练流" },
	{ dot: CHART_COLORS.blue, label: "模型流" },
	{ dot: "#3491FA", label: "推理流" },
	{ dot: CHART_COLORS.indigo, label: "评测流" },
];

// 强调色 → antd 语义 token (亮/暗主题自动适配)
function accentColor(t: ReturnType<typeof useLlmTokens>, accent: ModuleAccent): { fg: string, bg: string } {
	switch (accent) {
		case "success": return { fg: t.colorSuccess, bg: t.colorSuccessBg };
		case "warning": return { fg: t.colorWarning, bg: t.colorWarningBg };
		case "info": return { fg: t.colorInfo, bg: t.colorInfoBg };
		case "error": return { fg: t.colorError, bg: t.colorErrorBg };
		case "primary":
		default: return { fg: t.colorPrimary, bg: t.colorPrimaryBg };
	}
}

// pipeline 步骤状态 → antd 语义 token
function stepStatusColor(t: ReturnType<typeof useLlmTokens>, status: string): { color: string, bg: string, border: string } {
	switch (status) {
		case "completed": return { color: t.colorSuccess, bg: t.colorSuccessBg, border: t.colorSuccess };
		case "running": return { color: t.colorPrimary, bg: t.colorPrimaryBg, border: t.colorPrimary };
		default: return { color: t.colorTextQuaternary, bg: t.colorFillQuaternary, border: t.colorBorder };
	}
}

interface PipelineStepData {
	label: string
	time: string
	status: string
}

interface PipelineTrackProps {
	tagText: string
	tagColor: string
	title: string
	steps: PipelineStepData[]
	info: Array<{ icon: ReactNode, text: string }>
}

interface ModuleCardProps {
	module: DashboardModule
}

export default function LLMFactoryDashboard() {
	const token = useLlmTokens();

	// 接入真实 dashboard 数据 (替代硬编码 mock)
	const { data: dash, error, isError, refetch } = useQuery({
		queryKey: ["llm-factory-dashboard"],
		queryFn: () =>
			request
				.get("v1/metrics/dashboard")
				.json<DashboardData>(),
		refetchInterval: 30000, // 30秒刷新
	});

	// 派生数据 (纯函数, 已单测)
	const flywheelStats = buildFlywheelStats(dash);
	const bottomStats = buildBottomStats(dash);
	const textPipelineSteps = buildTextPipelineSteps(dash);
	const modules = buildModules(dash);

	const textTrackInfo = [
		{ icon: <CubeIcon />, text: "Qwen3-8B bf16" },
		{ icon: <RingIcon />, text: "LoRA r=16" },
		{ icon: <BarsIcon />, text: textPipelineSteps.find(s => s.label === "SFT 训练")?.time || "Loss: —" },
		{ icon: <MonitorIcon />, text: "RTX 5090 #0-1" },
	];
	const mmTrackInfo = [
		{ icon: <CubeIcon />, text: "Qwen3.5-4B" },
		{ icon: <RingIcon />, text: "LoRA r=32" },
		{ icon: <BarsIcon />, text: "Loss: —" },
		{ icon: <MonitorIcon />, text: "RTX 5090 #2" },
	];

	return (
		<div style={{ padding: "24px", background: token.colorBgLayout, minHeight: "100vh" }}>
			<div style={{ maxWidth: 1400, margin: "0 auto" }}>
				{/* Hero Section */}
				<div style={{ marginBottom: 48 }}>
					<h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, marginBottom: 8 }}>模型训练工厂</h1>
					<p style={{ margin: 0, fontSize: 16, color: token.colorTextSecondary }}>数据飞轮驱动，从原始数据到在线推理的全流程自动化管理</p>
				</div>

				{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="仪表盘真实接口不可用" />}

				<FlywheelHero flywheelStats={flywheelStats} bottomStats={bottomStats} />

				{/* Dual Track Pipeline */}
				<div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
					<PipelineTrack tagText="文本轨道" tagColor="blue" title="Qwen3-8B · Unsloth SFT" steps={textPipelineSteps} info={textTrackInfo} />
					<PipelineTrack tagText="多模态轨道" tagColor="cyan" title="Qwen3.5-4B · HF PEFT" steps={mmPipelineSteps} info={mmTrackInfo} />
				</div>

				{/* Module Grid */}
				<div>
					<h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>功能模块</h2>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
						{modules.map(module => (
							<ModuleCard key={module.key} module={module} />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================
// 飞轮可视化 (深色 hero, 品牌设计: 跨主题统一深色, 类终端配色)
// ============================================================
function FlywheelHero({
	flywheelStats,
	bottomStats,
}: {
	flywheelStats: ReturnType<typeof buildFlywheelStats>
	bottomStats: ReturnType<typeof buildBottomStats>
}) {
	const token = useLlmTokens();
	const navigate = useNavigate();

	return (
		<div
			style={{
				position: "relative",
				width: "100%",
				aspectRatio: "2.2/1",
				minHeight: 420,
				background: "linear-gradient(135deg, #0A1628 0%, #0F2140 40%, #132B52 100%)",
				borderRadius: 16,
				overflow: "hidden",
				border: "1px solid rgba(22, 93, 255, 0.15)",
				marginBottom: 32,
			}}
		>
			{/* Rings */}
			<Ring size={340} border="2px solid rgba(22, 93, 255, 0.12)" />
			<Ring size={220} border="2px dashed rgba(22, 93, 255, 0.08)" />
			<Ring size={100} border="2px solid rgba(22, 93, 255, 0.2)" />

			{/* Center */}
			<div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", zIndex: 2 }}>
				<div
					style={{
						width: 72,
						height: 72,
						margin: "0 auto 8px",
						borderRadius: "50%",
						background: "linear-gradient(135deg, #165DFF, #2F54EB)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: token.colorBgContainer,
						boxShadow: "0 0 40px rgba(22, 93, 255, 0.35)",
					}}
				>
					<IconGear />
				</div>
				<div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>数据飞轮</div>
				<div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>DATA FLYWHEEL</div>
			</div>

			{/* Flywheel Nodes — 统计数字使用真实数据 (node.label 来自 buildFlywheelStats) */}
			{flywheelStats.map((node, index) => {
				const pos = FLYWHEEL_NODE_POSITIONS[index];
				const config = FLYWHEEL_NODE_CONFIG[node.target];
				const labelParts = node.label.split(" ");
				return (
					<div
						key={node.target}
						style={{ position: "absolute", ...pos, width: 110, textAlign: "center", cursor: "pointer", transition: "transform 0.2s" }}
						className="hover:scale-110"
						onClick={() => {
							const route = FLYWHEEL_ROUTES[node.target];
							if (route)
								navigate(route);
						}}
					>
						<div
							style={{
								width: 52,
								height: 52,
								margin: "0 auto 8px",
								borderRadius: "50%",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								border: "2px solid",
								background: config.bg,
								color: config.color,
								borderColor: config.border,
							}}
						>
							{flywheelNodeIcons[node.target]}
						</div>
						<div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>{labelParts[0]}</div>
						<div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", marginTop: 2 }}>
							{labelParts.length > 1 ? labelParts.slice(1).join(" ") : ""}
						</div>
					</div>
				);
			})}

			{/* Legend */}
			<div style={{ position: "absolute", top: 16, right: 20, display: "flex", flexDirection: "column", gap: 6, zIndex: 5 }}>
				{FLYWHEEL_LEGEND.map(item => (
					<div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
						<div style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot }} />
						{item.label}
					</div>
				))}
			</div>

			{/* Bottom Stats */}
			<div style={{ position: "absolute", bottom: 16, left: 20, right: 20, display: "flex", gap: 12, zIndex: 5, flexWrap: "wrap" }}>
				{bottomStats.map(stat => (
					<div
						key={stat.label}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							padding: "6px 12px",
							background: "rgba(255, 255, 255, 0.06)",
							border: "1px solid rgba(255, 255, 255, 0.08)",
							borderRadius: 20,
							fontSize: 11,
							color: "rgba(255,255,255,0.7)",
							fontFamily: "monospace",
						}}
					>
						<span style={{ display: "flex", alignItems: "center", color: CHART_COLORS.success, marginRight: 4 }}>{stat.icon}</span>
						<span>
							{stat.label}
							{" "}
							<strong>{stat.value}</strong>
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function Ring({ size, border }: { size: number, border: string }) {
	return (
		<div
			style={{
				position: "absolute",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				borderRadius: "50%",
				border,
				width: size,
				height: size,
			}}
		/>
	);
}

// ============================================================
// 流水线轨道 (文本 / 多模态 共用, 消除重复代码)
// ============================================================
function PipelineTrack({ tagText, tagColor, title, steps, info }: PipelineTrackProps) {
	const token = useLlmTokens();
	return (
		<div
			className="h-full transition-all hover:shadow-md"
			style={{ borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer, padding: 24 }}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
				<Tag color={tagColor} style={{ borderRadius: "20px", padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
					{tagText}
				</Tag>
				<Text className="text-[18px] font-semibold">{title}</Text>
			</div>

			<div className="mb-6">
				{steps.map((step, index) => (
					<PipelineStep key={step.label} step={step} index={index} isLast={index === steps.length - 1} />
				))}
			</div>

			<div style={{ display: "flex", gap: 16, fontSize: 11, color: token.colorTextTertiary, flexWrap: "wrap" }}>
				{info.map(item => (
					<span key={item.text} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
						{item.icon}
						{item.text}
					</span>
				))}
			</div>
		</div>
	);
}

function PipelineStep({ step, index, isLast }: { step: PipelineStepData, index: number, isLast: boolean }) {
	const token = useLlmTokens();
	const s = stepStatusColor(token, step.status);
	const lineColor = step.status === "completed" ? token.colorSuccess : step.status === "running" ? token.colorPrimary : token.colorBorderSecondary;
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
			<div
				style={{
					width: 24,
					height: 24,
					borderRadius: "50%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 11,
					fontWeight: 600,
					background: s.bg,
					color: s.color,
					border: step.status === "pending" ? `1px solid ${s.border}` : `2px solid ${s.border}`,
					flexShrink: 0,
				}}
			>
				{step.status === "completed"
					? (
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
							<path d="M20 6L9 17l-5-5" />
						</svg>
					)
					: step.status === "running"
						? index + 1
						: <span style={{ fontSize: 10 }}>{index + 1}</span>}
			</div>
			<div style={{ minWidth: 80 }}>
				<div style={{ fontSize: 12, fontWeight: 500 }}>{step.label}</div>
				<div style={{ fontSize: 11, color: token.colorTextTertiary, fontFamily: "monospace" }}>{step.time || "—"}</div>
			</div>
			{!isLast && (
				<div style={{ flex: 1, height: 2, background: lineColor }} />
			)}
		</div>
	);
}

// ============================================================
// 模块卡片 (真实数据 stat, antd 语义色, CSS hover)
// ============================================================
function ModuleCard({ module }: ModuleCardProps) {
	const token = useLlmTokens();
	const navigate = useNavigate();
	const accent = accentColor(token, module.accent);
	return (
		<div
			onClick={() => navigate(module.link)}
			className="cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
			style={{
				borderRadius: 12,
				border: `1px solid ${token.colorBorderSecondary}`,
				background: token.colorBgContainer,
				padding: 16,
				height: "100%",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				style={{
					width: 40,
					height: 40,
					borderRadius: 8,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: accent.bg,
					color: accent.fg,
					marginBottom: 12,
				}}
			>
				{moduleIcons[module.iconKey]}
			</div>
			<div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{module.title}</div>
			<div style={{ fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.5, marginBottom: 8, flex: 1 }}>{module.desc}</div>
			<div style={{ fontSize: 11, color: token.colorTextSecondary, fontFamily: "monospace" }}>{module.stat}</div>
		</div>
	);
}

// ============================================================
// 内联微图标 (pipeline info 用, 与 icons.tsx 风格一致)
// ============================================================
function CubeIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
			<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
			<path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
		</svg>
	);
}
function RingIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
			<circle cx={12} cy={12} r={10} />
			<circle cx={12} cy={12} r={6} />
			<circle cx={12} cy={12} r={2} />
		</svg>
	);
}
function BarsIcon() {
	return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>;
}
function MonitorIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
			<rect x={2} y={3} width={20} height={14} rx={2} ry={2} />
			<path d="M8 21h8M12 17v4" />
		</svg>
	);
}
