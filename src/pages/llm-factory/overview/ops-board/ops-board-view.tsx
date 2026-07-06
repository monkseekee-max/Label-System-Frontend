import type { GpuMetric, SystemInfo, TrainingDashboard } from "#src/api/llm-factory/ops-board";
import { fetchAuditLogs } from "#src/api/audit";
import { fetchGpuStatus, fetchSystemInfo, fetchTrainingDashboard } from "#src/api/llm-factory/ops-board";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useAuthStore } from "#src/store/auth";
import { request } from "#src/utils/request";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, Empty, Row, Spin } from "antd";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import {
	deriveActivity,
	deriveGpuSummary,
	deriveServiceHealth,
	deriveTrainingSummary,
} from "./ops-board-data";

const HEALTH_BADGE = {
	healthy: { bg: "rgba(82, 196, 26, 0.12)", color: "#389e0d", text: "在线" },
	down: { bg: "rgba(255, 77, 79, 0.12)", color: "#cf1322", text: "离线" },
} as const;

const ACTIVITY_COLOR = {
	success: "#52c41a",
	running: "#1890ff",
	pending: "#faad14",
	error: "#ff4d4f",
} as const;

interface OpsBoardViewProps {
	/** 是否显示页面标题区 (内嵌到 Tab 时建议 false, 由 Tab label 提供标题) */
	showHeader?: boolean
}

/** 运营看板内容 (全部真实数据, 无硬编码; 不含外层 BasicContent, 可被首页 Tab 复用) */
export function OpsBoardView({ showHeader = true }: OpsBoardViewProps) {
	const token = useLlmTokens();

	// === 真实数据源 (全部接真实后端) ===
	const statsQuery = useQuery({
		queryKey: ["label-stats"],
		queryFn: () => {
			const tokenValue = useAuthStore.getState().token || "";
			if (!tokenValue)
				throw new Error("未认证: 缺少登录 token");
			return request.get("label/stats").json<{ data: Record<string, any> }>();
		},
		refetchInterval: 30000,
	});

	const gpuQuery = useQuery({
		queryKey: ["ops-board", "gpu"],
		queryFn: fetchGpuStatus,
		refetchInterval: 5000,
	});

	const systemInfoQuery = useQuery({
		queryKey: ["ops-board", "system-info"],
		queryFn: fetchSystemInfo,
		refetchInterval: 30000,
	});

	const trainingQuery = useQuery({
		queryKey: ["ops-board", "training-dashboard"],
		queryFn: fetchTrainingDashboard,
		refetchInterval: 30000,
	});

	const auditQuery = useQuery({
		queryKey: ["ops-board", "audit-logs"],
		queryFn: () => fetchAuditLogs({ offset: 0, limit: 8 }).then(r => r.result?.records ?? []),
		refetchInterval: 30000,
	});

	// === 派生展示数据 ===
	const _s = statsQuery.data?.data || {};
	const gpus: GpuMetric[] = gpuQuery.data?.gpus ?? [];
	const systemInfo: SystemInfo | undefined = systemInfoQuery.data;
	const training: TrainingDashboard | undefined = trainingQuery.data;
	const activities = useMemo(() => deriveActivity(auditQuery.data ?? []), [auditQuery.data]);
	const services = useMemo(() => (systemInfo ? deriveServiceHealth(systemInfo) : []), [systemInfo]);
	const gpuSummary = useMemo(() => deriveGpuSummary(gpus), [gpus]);
	const trainingSummary = useMemo(
		() => (training && systemInfo ? deriveTrainingSummary(training, systemInfo) : null),
		[training, systemInfo],
	);

	// 推理可用率: 从 vLLM 真实状态派生 (文本在线=100%, 离线=0%)
	const inferenceAvailability = useMemo(() => {
		if (!systemInfo)
			return null;
		const text = systemInfo.vllm.text.running;
		const mm = systemInfo.vllm.multimodal.running;
		if (text && mm)
			return 100;
		if (text || mm)
			return 50;
		return 0;
	}, [systemInfo]);

	// GPU 仪表盘 option (每块 GPU 真实 vramUsed/vramTotal)
	const createGaugeOption = useMemo(() => (gpu: GpuMetric) => ({
		series: [
			{
				type: "gauge",
				startAngle: 180,
				endAngle: 0,
				center: ["50%", "70%"],
				radius: "80%",
				min: 0,
				max: gpu.vramTotal,
				splitNumber: 5,
				axisLine: {
					lineStyle: {
						width: 12,
						color: [
							[gpu.vramTotal > 0 ? gpu.vramUsed / gpu.vramTotal : 0, "#1890ff"],
							[1, "#e8e8e8"],
						],
					},
				},
				axisTick: { show: false },
				axisLabel: { show: false },
				splitLine: { show: false },
				pointer: { show: false },
				title: {
					show: true,
					offsetCenter: [0, "10%"],
					textStyle: { fontSize: 14, fontWeight: 600, color: token.colorText },
				},
				detail: {
					valueAnimation: true,
					offsetCenter: [0, "-20%"],
					textStyle: { fontSize: 20, fontWeight: 700, color: CHART_COLORS.primary },
					formatter: "{value} GB",
				},
				data: [{ value: gpu.vramUsed, name: gpu.id }],
			},
		],
		tooltip: { formatter: () => `${gpu.name}: ${gpu.vramUsed}GB / ${gpu.vramTotal}GB (${gpu.utilizationDisplay})` },
	}), [token]);

	return (
		<div>
			{showHeader && (
				<div className="mb-4">
					<h2 className="m-0 text-xl font-semibold">运营看板</h2>
					<p className="mb-0 ml-0 mr-0 mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
						实时监控训练工厂运行状态与资源使用情况。
					</p>
				</div>
			)}
			{(statsQuery.isError) && <QueryErrorAlert error={statsQuery.error} onRetry={() => void statsQuery.refetch()} title="标注统计真实接口不可用" />}

			{/* Stats Cards — 真实数据 */}
			<Row className="mb-4" gutter={16}>
				<StatCard label="数据资产" value={_s.assets?.total ?? "-"} color={CHART_COLORS.primary} bg="rgba(22,93,255,0.1)" icon="data" />
				<StatCard label={`标注项（已审核 ${_s.qa?.reviewed_ok ?? "-"}）`} value={_s.qa?.total ?? "-"} color={CHART_COLORS.success} bg="rgba(82,196,26,0.1)" icon="qa" />
				<StatCard label="模型（产出）" value={trainingSummary?.totalModels ?? _s.models?.total ?? "-"} color={CHART_COLORS.purple} bg="rgba(114,46,209,0.1)" icon="model" />
				<StatCard label="推理可用率" value={inferenceAvailability == null ? "…" : `${inferenceAvailability}%`} color={CHART_COLORS.primary} bg="rgba(22,93,255,0.1)" icon="availability" />
			</Row>

			{/* 训练产出概览 — 真实 (avg_loss/训练数/模型/lora/评测), 取代假 Loss 曲线 */}
			<Card className="mb-4">
				<div className="mb-4 flex items-center justify-between">
					<div className="text-base font-semibold">训练产出概览</div>
					{trainingQuery.isError && <span className="text-xs" style={{ color: token.colorTextTertiary }}>训练指标接口不可用</span>}
				</div>
				{trainingSummary
					? (
						<Row gutter={16}>
							<SummaryCell label="累计训练" value={trainingSummary.totalTrainings} />
							<SummaryCell label="模型版本" value={trainingSummary.totalModels} />
							<SummaryCell label="平均 Loss" value={trainingSummary.avgLoss ?? "-"} />
							<SummaryCell label="评测通过" value={trainingSummary.totalEvals} />
							<SummaryCell label="活跃 LoRA" value={trainingSummary.activeLora ?? "-"} />
							<SummaryCell label="标注总量" value={trainingSummary.totalAnnotations} />
						</Row>
					)
					: (
						<Spin className="block py-6" />
					)}
			</Card>

			<Row gutter={16}>
				{/* 服务健康 — 真实 vLLM running 状态 */}
				<Col span={12}>
					<Card className="h-full">
						<div className="mb-4 text-base font-semibold">服务健康</div>
						{systemInfoQuery.isError && <span className="text-xs" style={{ color: token.colorTextTertiary }}>系统状态接口不可用</span>}
						{services.length === 0 && !systemInfoQuery.isError && <Spin size="small" />}
						<Row gutter={16}>
							{services.map((svc) => {
								const badge = svc.healthy ? HEALTH_BADGE.healthy : HEALTH_BADGE.down;
								return (
									<Col key={svc.key} className="mb-4" span={12}>
										<Card className="rounded-lg border" style={{ borderColor: token.colorBorder }}>
											<div className="mb-3 flex items-center justify-between">
												<div className="text-sm font-medium">{svc.name}</div>
												<span className="rounded-full px-2 py-[2px] text-[10px] font-semibold" style={{ background: badge.bg, color: badge.color }}>
													{badge.text}
												</span>
											</div>
											<div className="mb-2 text-xs" style={{ color: token.colorTextSecondary }}>
												<div>
													端口: :
													{svc.port ?? "-"}
												</div>
												<div>{svc.detail}</div>
											</div>
										</Card>
									</Col>
								);
							})}
						</Row>
					</Card>
				</Col>

				{/* 最近活动 — 真实审计日志 */}
				<Col span={12}>
					<Card className="h-full">
						<div className="mb-4 flex items-center justify-between">
							<div className="text-base font-semibold">最近活动</div>
							{auditQuery.isError && <span className="text-xs" style={{ color: token.colorTextTertiary }}>审计日志接口不可用</span>}
						</div>
						{activities.length === 0 && !auditQuery.isError && (
							<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无活动记录" />
						)}
						<div className="flex flex-col gap-3">
							{activities.map(item => (
								<div className="flex items-start gap-3 rounded-lg p-3" key={item.key} style={{ background: token.colorFillQuaternary }}>
									<div className="mt-[6px] h-2 w-2 flex-shrink-0 rounded-[50%]" style={{ background: ACTIVITY_COLOR[item.type] }} />
									<div className="flex-1">
										<div className="text-[13px]" style={{ color: token.colorText }}>{item.message}</div>
										<div className="mt-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>{item.time}</div>
									</div>
								</div>
							))}
						</div>
					</Card>
				</Col>
			</Row>

			{/* GPU 资源总览 — 真实 /system/gpu (动态 N 块) */}
			<Card className="mt-4">
				<div className="mb-4 text-base font-semibold">GPU 资源总览</div>
				{gpuQuery.isError && <span className="text-xs" style={{ color: token.colorTextTertiary }}>GPU 监控接口不可用</span>}
				{gpus.length > 0 && (
					<div className="mb-3 text-xs" style={{ color: token.colorTextTertiary }}>
						节点: 本机 · 型号:
						{" "}
						{gpus[0]?.name ?? "-"}
						{" "}
						· 共
						{" "}
						{gpuSummary.count}
						{" "}
						块 GPU · 总 VRAM:
						{" "}
						{gpuSummary.totalVram}
						{" "}
						GB
					</div>
				)}
				{gpus.length === 0 && !gpuQuery.isError && (
					<div className="py-8 text-center text-sm" style={{ color: token.colorTextSecondary }}>未检测到 GPU 设备</div>
				)}
				<Row gutter={24}>
					{gpus.map(gpu => (
						<Col key={gpu.id} span={gpus.length <= 4 ? Math.floor(24 / Math.max(gpus.length, 1)) : 6}>
							<ReactECharts className="h-[180px]" option={createGaugeOption(gpu)} notMerge={false} />
						</Col>
					))}
				</Row>
				{gpus.length > 0 && (
					<div className="mt-4 rounded-lg p-3" style={{ background: token.colorFillQuaternary }}>
						<Row gutter={16}>
							<Col span={8}>
								<div className="text-[11px]" style={{ color: token.colorTextTertiary }}>已用 VRAM</div>
								<div className="font-mono text-sm font-semibold">
									{gpuSummary.usedVram}
									{" "}
									GB (
									{gpuSummary.freeRatio}
									%)
								</div>
							</Col>
							<Col span={8}>
								<div className="text-[11px]" style={{ color: token.colorTextTertiary }}>剩余 VRAM</div>
								<div className="font-mono text-sm font-semibold" style={{ color: CHART_COLORS.success }}>
									{Math.round((gpuSummary.totalVram - gpuSummary.usedVram) * 10) / 10}
									{" "}
									GB
								</div>
							</Col>
							<Col span={8}>
								<div className="text-[11px]" style={{ color: token.colorTextTertiary }}>繁忙 GPU</div>
								<div className="font-mono text-sm font-semibold">
									{gpuSummary.busyCount}
									{" "}
									块
								</div>
							</Col>
						</Row>
					</div>
				)}
			</Card>
		</div>
	);
}

/** 统计卡片 (真实数值). */
function StatCard({ label, value, color, bg, icon }: { label: string, value: number | string, color: string, bg: string, icon: "data" | "qa" | "model" | "availability" }) {
	return (
		<Col span={6}>
			<Card className="rounded-xl border" style={{ borderColor: "inherit" }}>
				<Row align="middle" gutter={16}>
					<Col flex="1">
						<div className="font-mono text-[24px] font-bold" style={{ color }}>{value}</div>
						<div className="mt-1 text-xs opacity-80" style={{ color: "inherit" }}>{label}</div>
					</Col>
					<Col>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: bg }}>
							<StatIcon icon={icon} color={color} />
						</div>
					</Col>
				</Row>
			</Card>
		</Col>
	);
}

function StatIcon({ icon, color }: { icon: string, color: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" width="24" height="24">
			{icon === "data" && (
				<>
					<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="16" y1="13" x2="8" y2="13" />
				</>
			)}
			{icon === "qa" && <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />}
			{icon === "model" && (
				<>
					<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
					<line x1="8" y1="21" x2="16" y2="21" />
				</>
			)}
			{icon === "availability" && (
				<>
					<circle cx="12" cy="12" r="10" />
					<polyline points="12 6 12 12 16 14" />
				</>
			)}
		</svg>
	);
}

/** 训练产出单元格. */
function SummaryCell({ label, value }: { label: string, value: number | string | null }) {
	return (
		<Col className="text-center" span={4}>
			<div className="font-mono text-2xl font-bold" style={{ color: CHART_COLORS.primary }}>{value}</div>
			<div className="mt-1 text-xs" style={{ color: "rgba(0,0,0,0.45)" }}>{label}</div>
		</Col>
	);
}
