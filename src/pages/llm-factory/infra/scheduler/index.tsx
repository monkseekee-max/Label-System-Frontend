import type { FrontendMode } from "#src/api/llm-factory/scheduler";
import {
	approveProposal,
	fetchSchedulerMode,
	fetchSchedulerProposals,
	fetchSchedulerStatus,
	MODE_LABELS,
	toFrontendMode,
	updateSchedulerMode,
} from "#src/api/llm-factory/scheduler";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { cn } from "#src/utils/cn";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import * as React from "react";

const { Text } = Typography;

// ============================================================
// 静态: 三种模式的描述 (UI 展示用, 不含数据)
// ============================================================
interface ModeCard {
	id: FrontendMode
	title: string
	desc: string
	iconBg: string
	iconColor: string
	icon: React.ReactNode
}

const MODES: ModeCard[] = [
	{
		id: "auto",
		title: "自动模式",
		desc: "数据量达到阈值时自动触发训练，无需人工介入。适合数据稳定增长的成熟阶段。",
		iconBg: "#E8F4FF",
		iconColor: "#165DFF",
		icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
	},
	{
		id: "semi",
		title: "半自动模式",
		desc: "数据量达到阈值后生成训练建议，需要人工确认后触发训练。平衡效率与控制。",
		iconBg: "rgba(250, 173, 20, 0.1)",
		iconColor: "#faad14",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
				<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
				<line x1="12" y1="9" x2="12" y2="13" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</svg>
		),
	},
	{
		id: "manual",
		title: "手动模式",
		desc: "所有训练触发需要人工通过 API/CLI 或管理界面手动操作。最精细的控制粒度。",
		iconBg: "rgba(22, 93, 255, 0.1)",
		iconColor: "#165DFF",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
				<circle cx="12" cy="12" r="10" />
				<polyline points="12 6 12 12 16 14" />
			</svg>
		),
	},
];

function formatTime(v: string | null): string {
	return v ? new Date(v).toLocaleString("zh-CN") : "—";
}

function ModeCardComponent({ mode, selected, onSelect, loading }: { mode: ModeCard, selected: boolean, onSelect: () => void, loading: boolean }) {
	const token = useLlmTokens();
	return (
		<div
			className={cn("relative cursor-pointer rounded-xl border-2 border-solid p-6 text-center transition-all duration-200 ease-in-out")}
			onClick={onSelect}
			style={{
				borderColor: selected ? token.colorPrimary : token.colorBorder,
				background: selected ? token.colorPrimaryBg : token.colorBgContainer,
				opacity: loading ? 0.7 : 1,
			}}
		>
			{selected && (
				<div
					className="absolute right-3 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full"
					style={{ background: CHART_COLORS.primary, color: token.colorBgContainer }}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
						<path d="M20 6L9 17l-5-5" />
					</svg>
				</div>
			)}
			<div className="mx-auto mb-4 mt-0 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: mode.iconBg, color: mode.iconColor }}>
				{mode.icon}
			</div>
			<div className="mb-1 text-base font-semibold">{mode.title}</div>
			<div className="mb-4 text-[13px] leading-[1.5]" style={{ color: token.colorTextSecondary }}>{mode.desc}</div>
			<div className="mt-4 border-t pt-3 text-xs" style={{ borderTopColor: selected ? token.colorPrimaryBg : token.colorBorder }}>
				{selected ? <Tag color="#165DFF" className="mb-1">当前启用</Tag> : <Tag>未启用</Tag>}
			</div>
		</div>
	);
}

export default function LLMFactoryScheduler() {
	const token = useLlmTokens();
	const queryClient = useQueryClient();

	// —— 真实 API: 调度模式 ——
	const { data: modeResp, error, isError, refetch } = useQuery({
		queryKey: ["scheduler-mode"],
		queryFn: fetchSchedulerMode,
		refetchInterval: 10000,
	});
	const frontendMode = toFrontendMode(modeResp?.mode ?? "manual");
	const [selectedMode, setSelectedMode] = React.useReducer((_: FrontendMode, next: FrontendMode) => next, "manual");

	React.useEffect(() => {
		setSelectedMode(frontendMode);
	}, [frontendMode]);

	const switchMode = useMutation({
		mutationFn: (newMode: FrontendMode) => updateSchedulerMode(newMode),
		onSuccess: () => {
			window.$message?.success("调度模式已切换");
			queryClient.invalidateQueries({ queryKey: ["scheduler-mode"] });
		},
		onError: () => window.$message?.error("切换失败"),
	});

	const handleSelect = (m: FrontendMode) => {
		setSelectedMode(m);
		switchMode.mutate(m);
	};

	// —— 真实 API: 调度状态 (统计 + 阈值判定) ——
	const { data: status, isLoading: statusLoading } = useQuery({
		queryKey: ["scheduler-status"],
		queryFn: fetchSchedulerStatus,
		refetchInterval: 15000,
	});

	// —— 真实 API: 待批准训练建议 ——
	const { data: proposalsResp, isLoading: proposalsLoading } = useQuery({
		queryKey: ["scheduler-proposals"],
		queryFn: fetchSchedulerProposals,
		refetchInterval: 15000,
	});
	const proposals = proposalsResp?.proposals ?? [];

	const approveMutation = useMutation({
		mutationFn: (proposalId: string) => approveProposal(proposalId),
		onSuccess: () => {
			window.$message?.success("已批准，训练即将触发");
			queryClient.invalidateQueries({ queryKey: ["scheduler-proposals"] });
		},
		onError: e => window.$message?.error(`批准失败: ${e instanceof Error ? e.message : String(e)}`),
	});

	const stats = status?.stats;

	return (
		<BasicContent>
			<div className="mb-4">
				<h1 className="m-0 text-[24px] font-bold">调度管理</h1>
				<p className="mb-0 ml-0 mr-0 mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
					自动/半自动/手动三模式配置、调度状态与训练建议管理。
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="调度模式真实接口不可用" />}

			{/* 当前模式指示器 */}
			<Card className="mb-6 rounded-xl border" style={{ borderColor: token.colorBorder }} styles={{ body: { padding: "16px 20px" } }}>
				<div className="flex items-center gap-4">
					<div className="h-[10px] w-[10px] animate-[pulse_1.5s_infinite] rounded-full" style={{ background: status?.should_trigger ? CHART_COLORS.success : CHART_COLORS.primary }} />
					<span className="font-semibold" style={{ color: token.colorText }}>
						当前模式：
						{MODE_LABELS[selectedMode] ?? selectedMode}
					</span>
					<Text className="text-[13px]" style={{ color: token.colorTextSecondary }}>
						{status ? status.reason || "运行正常" : "加载中…"}
					</Text>
				</div>
			</Card>

			{/* 触发模式卡片 */}
			<Row gutter={20} className="mb-6">
				{MODES.map(mode => (
					<Col span={8} key={mode.id}>
						<ModeCardComponent mode={mode} selected={selectedMode === mode.id} onSelect={() => handleSelect(mode.id)} loading={switchMode.isPending} />
					</Col>
				))}
			</Row>

			{/* 调度状态 (真实统计) */}
			<Row gutter={20} className="mb-6">
				<Col span={24}>
					<Card title={<span className="text-base font-semibold">调度状态</span>} className="rounded-xl border" style={{ borderColor: token.colorBorder }} loading={statusLoading}>
						{stats
							? (
								<Row gutter={16}>
									<Col xs={12} md={6}>
										<StatBox label="新增数据 (自上次训练)" value={`${stats.new_since_last} 条`} highlight={status?.should_trigger} />
									</Col>
									<Col xs={12} md={6}>
										<StatBox label="已清洗总量" value={`${stats.cleaned_count} 条`} />
									</Col>
									<Col xs={12} md={6}>
										<StatBox label="平均质量分" value={stats.avg_quality ? stats.avg_quality.toFixed(3) : "—"} />
									</Col>
									<Col xs={12} md={6}>
										<StatBox label="上次训练时间" value={formatTime(stats.last_training_at)} />
									</Col>
								</Row>
							)
							: (
								<Text style={{ color: token.colorTextSecondary }}>暂无调度状态数据</Text>
							)}
						{status?.should_trigger && (
							<Alert
								className="mt-4"
								type="success"
								showIcon
								message="已达触发阈值"
								description="数据量满足训练条件。半自动模式下请在下方「训练建议」确认；自动模式将自动触发。"
							/>
						)}
					</Card>
				</Col>
			</Row>

			{/* 训练建议 (真实 proposals) */}
			<Card
				title={(
					<Space>
						<span className="text-base font-semibold">训练建议</span>
						<Text className="text-[13px]" style={{ color: token.colorTextSecondary }}>
							{proposals.length > 0 ? `${proposals.length} 条待确认` : "基于数据增长趋势自动生成"}
						</Text>
					</Space>
				)}
				className="mb-6 rounded-xl border"
				style={{ borderColor: token.colorBorder }}
			>
				{proposalsLoading
					? <Text style={{ color: token.colorTextSecondary }}>加载中…</Text>
					: proposals.length > 0
						? (
							<Space direction="vertical" className="w-full">
								{proposals.map(p => (
									<ProposalRow
										key={p.proposal_id}
										proposal={p}
										onApprove={() => approveMutation.mutate(p.proposal_id)}
										approving={approveMutation.isPending}
									/>
								))}
							</Space>
						)
						: (
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description={selectedMode === "manual" ? "手动模式下不生成训练建议" : "暂无待确认的训练建议"}
							/>
						)}
			</Card>

			{/* 训练时间窗口 + 调度历史 (后端未实现持久化, 诚实标注) */}
			<Row gutter={20}>
				<Col xs={24} lg={12}>
					<Card title={<span className="text-base font-semibold">训练时间窗口</span>} className="rounded-xl border" style={{ borderColor: token.colorBorder }}>
						<Alert
							type="info"
							showIcon
							message="配置项需后端支持"
							description="时间窗口、宽限等待、超时上限等调度策略由后端训练调度引擎控制，当前版本未开放界面配置入口。如需调整请联系管理员通过配置文件修改。"
						/>
					</Card>
				</Col>
				<Col xs={24} lg={12}>
					<Card title={<span className="text-base font-semibold">调度历史</span>} className="rounded-xl border" style={{ borderColor: token.colorBorder }}>
						<Alert
							type="info"
							showIcon
							message="历史记录需后端支持"
							description="调度触发历史（时间/模式/结果/操作人）由后端训练任务记录，当前版本未提供独立查询端点。完整训练记录请在「训练任务」页面查看。"
						/>
					</Card>
				</Col>
			</Row>
		</BasicContent>
	);
}

// ============================================================
// 子组件
// ============================================================
function StatBox({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
	const token = useLlmTokens();
	return (
		<div
			className="rounded-md p-3"
			style={{
				background: highlight ? token.colorSuccessBg : token.colorFillQuaternary,
				border: highlight ? `1px solid ${token.colorSuccessBorder}` : "none",
			}}
		>
			<div className="text-xs" style={{ color: token.colorTextTertiary }}>{label}</div>
			<div className="mt-1 text-base font-semibold" style={{ color: highlight ? token.colorSuccess : token.colorText }}>
				{value}
			</div>
		</div>
	);
}

function ProposalRow({ proposal, onApprove, approving }: { proposal: { proposal_id: string, reason?: string, created_at?: string }, onApprove: () => void, approving: boolean }) {
	const token = useLlmTokens();
	return (
		<div
			className="flex items-center gap-4 rounded-lg border p-4"
			style={{ borderColor: token.colorBorder, background: token.colorBgContainer }}
		>
			<div
				className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
				style={{ background: token.colorPrimaryBg, color: token.colorPrimary }}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
					<path d="M9 18h6M10 22h4" />
					<path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14" />
				</svg>
			</div>
			<div className="flex-1">
				<div className="text-sm font-medium" style={{ color: token.colorText }}>
					训练建议
					{proposal.proposal_id && <Text className="ml-2 text-xs font-mono" style={{ color: token.colorTextTertiary }}>{proposal.proposal_id}</Text>}
				</div>
				<div className="mt-1 text-[13px]" style={{ color: token.colorTextSecondary }}>
					{proposal.reason || "数据量已达触发阈值，建议执行增量训练"}
				</div>
			</div>
			<Button type="primary" size="small" loading={approving} onClick={onApprove}>批准训练</Button>
		</div>
	);
}
