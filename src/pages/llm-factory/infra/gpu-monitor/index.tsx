import type { AlertItem, GPUMetric } from "./gpu-data";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { request } from "#src/utils/request";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, Empty, Row, Typography } from "antd";

import { useMemo } from "react";
import { deriveGpuAlerts } from "./gpu-data";

const { Text } = Typography;

const STATUS_CONFIG: Record<string, { color: string, bg: string, text: string }> = {
	busy: { color: CHART_COLORS.warning, bg: "rgba(250, 173, 20, 0.1)", text: "训练中" },
	active: { color: CHART_COLORS.success, bg: "rgba(82, 196, 26, 0.1)", text: "推理" },
	idle: { color: CHART_COLORS.neutral, bg: "rgba(140, 140, 140, 0.15)", text: "空闲" },
};

function GPUCard({ gpu }: { gpu: GPUMetric }) {
	const token = useLlmTokens();
	const statusConfig = STATUS_CONFIG[gpu.status];
	const gaugePercent = gpu.utilization;
	const circumference = 365;
	const dashArray = (gaugePercent / 100) * circumference;

	// Gauge color based on utilization
	const gaugeColor = gpu.utilization > 80 ? "#FF7D00" : gpu.utilization > 50 ? "#F53F3F" : "#00B42A";

	return (
		<Card
			style={{
				borderRadius: 12,
				border: `1px solid ${token.colorBorder}`,
			}}
		>
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
				<Text style={{ fontSize: 16, fontWeight: 600 }}>{gpu.name}</Text>
				<span
					style={{
						padding: "3px 8px",
						borderRadius: "12px",
						fontSize: 11,
						fontWeight: 600,
						background: statusConfig.bg,
						color: statusConfig.color,
					}}
				>
					{statusConfig.text}
				</span>
			</div>

			{/* Big Gauge */}
			<div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 16px" }}>
				<svg viewBox="0 0 140 140" className="w-full h-full">
					<circle cx="70" cy="70" r="58" fill="none" stroke={token.colorBorderSecondary} strokeWidth="10" />
					<circle
						cx="70"
						cy="70"
						r="58"
						fill="none"
						stroke={gaugeColor}
						strokeWidth={10}
						strokeDasharray={`${dashArray} ${circumference}`}
						strokeLinecap="round"
						transform="rotate(-90 70 70)"
						style={{ transition: "stroke-dasharray 0.6s ease" }}
					/>
				</svg>
				<div
					style={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						textAlign: "center",
					}}
				>
					<div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: token.colorText }}>
						{gpu.utilization}
						%
					</div>
					<div style={{ fontSize: 11, color: token.colorTextTertiary }}>
						{gpu.vramUsed}
						{" "}
						/
						{gpu.vramTotal}
						{" "}
						GB
					</div>
				</div>
			</div>

			{/* Details */}
			<Row gutter={12}>
				<Col xs={24} sm={12} lg={12}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							padding: "8px 12px",
							background: token.colorFillQuaternary,
							borderRadius: 6,
						}}
					>
						<Text className="text-xs" style={{ color: token.colorTextTertiary }}>温度</Text>
						<Text className="text-xs font-medium font-mono">
							{gpu.temperature}
							°C
						</Text>
					</div>
				</Col>
				<Col xs={24} sm={12} lg={12}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							padding: "8px 12px",
							background: token.colorFillQuaternary,
							borderRadius: 6,
						}}
					>
						<Text className="text-xs" style={{ color: token.colorTextTertiary }}>功耗</Text>
						<Text className="text-xs font-medium font-mono">
							{gpu.power}
							W
						</Text>
					</div>
				</Col>
			</Row>
			<Row gutter={12} className="mb-2">
				<Col xs={24} sm={12} lg={12}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							padding: "8px 12px",
							background: token.colorFillQuaternary,
							borderRadius: 6,
						}}
					>
						<Text className="text-xs" style={{ color: token.colorTextTertiary }}>利用率</Text>
						<Text className="text-xs font-medium font-mono">{gpu.utilizationDisplay}</Text>
					</div>
				</Col>
				<Col xs={24} sm={12} lg={12}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							padding: "8px 12px",
							background: token.colorFillQuaternary,
							borderRadius: 6,
						}}
					>
						<Text className="text-xs" style={{ color: token.colorTextTertiary }}>任务</Text>
						<Text className="text-xs font-medium font-mono">{gpu.task}</Text>
					</div>
				</Col>
			</Row>

			{/* Temperature Bar */}
			<div>
				<div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
					<span>温度</span>
					<span style={{ fontFamily: "monospace", fontSize: 12 }}>
						{gpu.temperature}
						°C / 90°C
					</span>
				</div>
				<div style={{ width: "100%", height: 6, background: token.colorBgLayout, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
					<div
						style={{
							height: "100%",
							borderRadius: 3,
							width: `${gpu.temperaturePercent}%`,
							transition: "width 0.5s ease",
							background:
								gpu.temperaturePercent > 75
									? "linear-gradient(90deg, #FF7D00, #F53F3F)"
									: gpu.temperaturePercent > 50
										? "linear-gradient(90deg, #FAAD14, #FF7D00)"
										: "linear-gradient(90deg, #00B42A, #23C343)",
						}}
					/>
				</div>
			</div>
		</Card>
	);
}

function AlertItemComponent({ alert }: { alert: AlertItem }) {
	const token = useLlmTokens();
	const config = {
		warn: { bg: "rgba(250, 173, 20, 0.1)", color: CHART_COLORS.warning, icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
				<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
				<path d="M12 9v4M12 17h.01" />
			</svg>
		) },
		info: { bg: "#e6f7ff", color: CHART_COLORS.primary, icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
				<circle cx="12" cy="12" r="10" />
				<path d="M12 16v-4M12 8h.01" />
			</svg>
		) },
		danger: { bg: "rgba(255, 77, 79, 0.1)", color: CHART_COLORS.error, icon: <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><circle cx="12" cy="12" r="8" fill="#F53F3F" /></svg> },
	};
	const iconConfig = config[alert.type];

	return (
		<div
			key={alert.id}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "12px 16px",
				background: token.colorBgContainer,
				border: `1px solid ${token.colorBorder}`,
				borderRadius: 8,
				marginBottom: 8,
				fontSize: 13,
				color: token.colorTextSecondary,
			}}
		>
			<div
				style={{
					width: 16,
					height: 16,
					borderRadius: "50%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
					background: iconConfig.bg,
					color: iconConfig.color,
				}}
			>
				{iconConfig.icon}
			</div>
			<Text>{alert.message}</Text>
		</div>
	);
}

export default function LLMFactoryGpuMonitor() {
	const token = useLlmTokens();
	// Phase 3.6: 接入真实 GPU 数据 (替代硬编码 GPU_DATA)
	const { data: gpuResp, isLoading, error, isError, refetch } = useQuery({
		queryKey: ["gpu-status"],
		queryFn: () => request.get("v1/system/gpu").json<{ gpus: GPUMetric[], available: boolean }>(),
		refetchInterval: 5000, // 5秒轮询实时刷新
	});
	const gpus = gpuResp?.gpus ?? [];
	const gpuCount = gpus.length;
	// 告警基于真实 GPU 指标动态派生 (高温/显存接近上限/空闲提示)
	const alerts = useMemo(() => deriveGpuAlerts(gpus), [gpus]);
	return (
		<BasicContent>
			<div className="mb-4">
				<h1 className="m-0 text-2xl font-bold">GPU 监控</h1>
				<p style={{ margin: "4px 0 0 0", color: token.colorTextSecondary, fontSize: 14 }}>
					{gpuCount > 0 ? `${gpuCount} × GPU 实时资源监控` : "暂无可用 GPU"}
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="GPU 监控真实接口不可用" />}

			{/* GPU Grid */}
			<Row gutter={20} className="mb-6">
				{isLoading && <Col span={24}><div className="text-center p-10" style={{ color: token.colorTextSecondary }}>加载 GPU 状态...</div></Col>}
				{gpuCount === 0 && !isLoading && <Col span={24}><div className="text-center p-10" style={{ color: token.colorTextSecondary }}>未检测到 GPU 设备</div></Col>}
				{gpus.map(gpu => (
					<Col key={gpu.id} span={gpuCount === 1 ? 24 : 12} className="mb-5">
						<GPUCard gpu={gpu} />
					</Col>
				))}
			</Row>

			{/* Alerts — 基于真实 GPU 指标动态派生 */}
			<Card
				style={{
					borderRadius: 12,
					border: `1px solid ${token.colorBorder}`,
				}}
			>
				<div className="text-base font-semibold mb-4">
					告警记录
					{alerts.length > 0 && (
						<Text className="ml-2 text-xs font-normal" style={{ color: token.colorTextSecondary }}>
							（
							{alerts.length}
							{" "}
							条，基于实时指标）
						</Text>
					)}
				</div>
				{alerts.length > 0
					? <div>{alerts.map(alert => <AlertItemComponent key={alert.id} alert={alert} />)}</div>
					: (
						<Empty
							description={gpuCount === 0 ? "暂无 GPU 设备" : "当前所有 GPU 指标正常"}
							image={Empty.PRESENTED_IMAGE_SIMPLE}
						/>
					)}
			</Card>
		</BasicContent>
	);
}
