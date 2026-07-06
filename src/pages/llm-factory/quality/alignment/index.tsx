import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { request } from "#src/utils/request";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Progress, Row, Space, Tabs, Tag } from "antd";
import { useState } from "react";

// SVG Icon Components
function IconEdit() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
			<path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
		</svg>
	);
}

function IconStar() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
			<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
		</svg>
	);
}

function IconBan() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
			<circle cx="12" cy="12" r="10" />
			<line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
		</svg>
	);
}

function IconFileText() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
			<path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<line x1="10" y1="9" x2="8" y2="9" />
		</svg>
	);
}

function IconCheck() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

function IconChart() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
			<line x1="12" y1="20" x2="12" y2="10" />
			<line x1="18" y1="20" x2="18" y2="4" />
			<line x1="6" y1="20" x2="6" y2="16" />
		</svg>
	);
}

interface FeedbackItem {
	key: string
	type: "correction" | "preference" | "rejection"
	expert: string
	time: string
	tag: string
	content: string
	modelOutput: string
	correction?: string
	preferred?: string
}

const FEEDBACK_PENDING_DATA: FeedbackItem[] = [
	{
		key: "1",
		type: "correction",
		expert: "张教授",
		time: "2 小时前",
		tag: "修正",
		content: "模型输出的技术参数描述与原始文档不一致，第 3 段关于 RTX 5090 显存规格的描述有误，应为 \"24GB GDDR7\" 而非 \"24GB GDDR6X\"。",
		modelOutput: "RTX 5090 配备 24GB GDDR6X 显存，基于 Blackwell 架构，支持 CUDA 12.8。",
		correction: "RTX 5090 配备 24GB GDDR7 显存，基于 Blackwell 架构，支持 CUDA 12.8。",
	},
	{
		key: "2",
		type: "preference",
		expert: "李研究员",
		time: "5 小时前",
		tag: "偏好",
		content: "对于 LoRA 训练配置的 QA 回答，偏好更详细的参数解释方式，建议在回答中增加每个参数对训练效果的影响说明。",
		modelOutput: "LoRA Rank=16, Alpha=32, 使用 bf16 精度训练，序列长度 4096。",
		preferred:
			"LoRA 采用 Rank=16（决定可训练参数量）、Alpha=32（缩放因子，设为 2×Rank 可平衡学习率），bf16 精度训练（Qwen3 官方推荐），序列长度 4096（24GB 显存上限）。",
	},
	{
		key: "3",
		type: "rejection",
		expert: "王博士",
		time: "昨天",
		tag: "拒绝",
		content: "模型在回答\"QLoRA 4-bit 量化是否适用于 Qwen3\"时声称可行，但 Qwen3 官方明确不推荐 4-bit 量化，QA 精度损失不可接受。此回答属于严重幻觉。",
		modelOutput: "可以使用 QLoRA 4-bit 量化对 Qwen3-8B 进行微调，这样可以节省大量显存…",
	},
	{
		key: "4",
		type: "correction",
		expert: "赵工",
		time: "昨天",
		tag: "修正",
		content: "vLLM 0.19+ 的 LoRA 热插拔使用的是 model 字段切换方式，而非 dynamic adapter 方式。文档描述有误。",
		modelOutput: "vLLM 的 LoRA 热插拔通过 dynamic adapter loading 机制动态加载和卸载 LoRA 适配器…",
		correction: "vLLM 的 LoRA 热插拔通过 model 字段指定 LoRA 名称 实现，在请求时通过 `model=\"qwen3-8b/lora_v005\"` 路由到对应适配器。",
	},
];

const FEEDBACK_HISTORY_DATA = [
	{ key: "1", time: "06/10 14:30", expert: "张教授", type: "修正", tag: "修正", summary: "RTX 5090 显存规格 GDDR6X → GDDR7", sftRound: "sft_004", status: "已训练" },
	{ key: "2", time: "06/09 16:20", expert: "李研究员", type: "偏好", tag: "偏好", summary: "LoRA 参数解释增加影响说明", sftRound: "sft_004", status: "已训练" },
	{ key: "3", time: "06/09 10:45", expert: "王博士", type: "拒绝", tag: "拒绝", summary: "QLoRA 4-bit 适用性幻觉", sftRound: "sft_003", status: "已训练" },
	{ key: "4", time: "06/08 09:15", expert: "赵工", type: "修正", tag: "修正", summary: "vLLM LoRA 热插拔方式更正", sftRound: "sft_003", status: "已训练" },
	{ key: "5", time: "06/07 14:00", expert: "张教授", type: "偏好", tag: "偏好", summary: "推理服务停机流程描述更详细", sftRound: "sft_002", status: "已训练" },
	{ key: "6", time: "06/06 11:30", expert: "李研究员", type: "修正", tag: "修正", summary: "Unsloth 版本号 2025 → 2026", sftRound: "sft_002", status: "已训练" },
];

const SAMPLES_DATA = [
	{
		key: "1",
		priority: "高优",
		type: "事实性错误",
		question: "RTX 5090 使用什么类型的显存？",
		modelOutput: "RTX 5090 配备 24GB GDDR6X 显存。",
	},
	{
		key: "2",
		priority: "严重",
		type: "幻觉",
		question: "Qwen3 可以使用 4-bit 量化训练吗？",
		modelOutput: "可以，使用 QLoRA 4-bit 量化可以显著节省显存，适合在 RTX 5090 上训练。",
	},
	{
		key: "3",
		priority: "改进",
		type: "回答质量",
		question: "训练/推理资源隔离是怎么实现的？",
		modelOutput: "推理常驻运行，训练时停推理，训练完重启。",
	},
	{
		key: "4",
		priority: "高优",
		type: "事实性错误",
		question: "vLLM 的 LoRA 热插拔是如何实现的？",
		modelOutput: "通过 dynamic adapter loading 机制动态加载和卸载 LoRA 适配器。",
	},
];

const PRIORITY_CONFIG: Record<string, { color: string, bg: string }> = {
	高优: { color: "orange", bg: "orange" },
	严重: { color: "red", bg: "red" },
	改进: { color: "blue", bg: "blue" },
};

// Type icons for feedback items
const typeIcons: Record<string, React.ReactNode> = {
	correction: <IconEdit />,
	preference: <IconStar />,
	rejection: <IconBan />,
};

export default function Alignment() {
	const token = useLlmTokens();
	const [activeTab, setActiveTab] = useState("pending");

	// P2: 接入真实待对齐样本 (替代 SAMPLES_DATA 硬编码)
	const { data: pendingResp, error, isError, refetch } = useQuery({
		queryKey: ["alignment-pending"],
		queryFn: () =>
			request
				.get("v1/alignment/pending")
				.json<{
				total_pending: number
				samples: Array<{
					id: string
					question: string
					model_answer: string
					auto_scores: { similarity: number | null, confidence: number | null }
					priority: string
				}>
			}>(),
		refetchInterval: 30000,
	});

	// 后端 priority (high/medium) → 前端展示 (高优/改进)
	const priorityMap: Record<string, string> = { high: "高优", medium: "改进", low: "改进" };
	const realSamples = (pendingResp?.samples ?? []).map(s => ({
		key: s.id,
		priority: priorityMap[s.priority] ?? "改进",
		type: s.auto_scores.confidence != null && s.auto_scores.confidence < 0.5 ? "幻觉" : "回答质量",
		question: s.question,
		modelOutput: s.model_answer,
	}));

	const renderPendingItem = (item: FeedbackItem) => {
		const typeConfig = {
			correction: { color: token.colorWarning, bg: "#fff7e6" },
			preference: { color: token.colorPrimary, bg: "#e6f7ff" },
			rejection: { color: token.colorError, bg: "#fff1f0" },
		};
		const config = typeConfig[item.type];
		const icon = typeIcons[item.type];

		return (
			<div
				key={item.key}
				className="flex gap-4 rounded-lg border px-5 py-4 [transition:border-color_0.2s]"
				style={{
					background: token.colorBgContainer,
					borderColor: token.colorBorder,
				}}
			>
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
					style={{
						background: config.bg,
						color: config.color,
					}}
				>
					{icon}
				</div>
				<div className="min-w-0 flex-1">
					<div className="mb-2 flex items-center gap-3">
						<span className="font-semibold">{item.expert}</span>
						<Tag color={config.color}>{item.tag}</Tag>
						<span className="text-xs" style={{ color: token.colorTextTertiary }}>{item.time}</span>
					</div>
					<div className="mb-2 text-[13px] leading-[1.6]" style={{ color: token.colorTextSecondary }}>
						{item.content}
					</div>
					<div
						className="max-h-[120px] overflow-y-auto rounded border border-[#f5f5f5] p-3 text-xs leading-[1.6]"
						style={{
							background: token.colorFillQuaternary,
							color: token.colorTextSecondary,
						}}
					>
						<div className="mb-1 text-[11px] font-medium" style={{ color: token.colorTextTertiary }}>
							模型输出 (v005)
						</div>
						{item.type === "correction"
							? (
								<>
									{item.modelOutput.split(item.correction || "").map(part =>
										part === item.correction
											? (
												<span key={part} className="rounded-[2px] bg-[rgba(245,158,11,0.12)] px-1">
													{part}
												</span>
											)
											: (
												part
											),
									)}
									{item.correction && (
										<div className="mt-2">
											<span className="mb-1 text-[11px] font-medium" style={{ color: token.colorTextTertiary }}>专家修正</span>
											<span className="rounded-[2px] bg-[rgba(22,93,255,0.12)] px-1">
												{item.correction}
											</span>
										</div>
									)}
								</>
							)
							: item.type === "preference"
								? (
									<>
										<div className="mb-1 text-[11px] font-medium" style={{ color: token.colorTextTertiary }}>回答 A（当前模型）</div>
										<div className="mb-2">{item.modelOutput}</div>
										{item.preferred && (
											<>
												<div className="mb-1 text-[11px] font-medium" style={{ color: token.colorTextTertiary }}>回答 B（偏好）</div>
												<span className="rounded-[2px] bg-[rgba(22,93,255,0.12)] px-1">
													{item.preferred}
												</span>
											</>
										)}
									</>
								)
								: (
									item.modelOutput
								)}
					</div>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button size="small" type="primary">
						采纳
					</Button>
					<Button size="small">忽略</Button>
				</div>
			</div>
		);
	};

	const renderHistoryRow = (item: typeof FEEDBACK_HISTORY_DATA[number]) => (
		<tr key={item.key} className="border-b border-[#f5f5f5]">
			<td className="px-2 py-3 text-xs" style={{ color: token.colorTextTertiary }}>{item.time}</td>
			<td className="px-2 py-3">{item.expert}</td>
			<td>
				<Tag color={item.type === "修正" ? "orange" : item.type === "偏好" ? "blue" : "red"}>{item.tag}</Tag>
			</td>
			<td>{item.summary}</td>
			<td className="px-2 py-3 font-mono">{item.sftRound}</td>
			<td>
				<Tag color="success">已训练</Tag>
			</td>
		</tr>
	);

	const renderSampleCard = (item: typeof SAMPLES_DATA[number]) => {
		const config = PRIORITY_CONFIG[item.priority];

		return (
			<Card
				key={item.key}
				className="rounded-xl border"
				style={{
					borderColor: token.colorBorder,
				}}
			>
				<div className="mb-3 flex items-center gap-2 text-sm font-semibold">
					<Tag color={config.color} className="mr-0">
						{item.priority}
					</Tag>
					待对齐 —
					{" "}
					{item.type}
				</div>
				<div className="mb-2 rounded p-3" style={{ background: token.colorFillQuaternary }}>
					<div className="mb-1 text-[11px] font-medium" style={{ color: token.colorTextTertiary }}>问题</div>
					<div className="text-[13px]" style={{ color: token.colorTextSecondary }}>{item.question}</div>
				</div>
				<div className="rounded p-3" style={{ background: token.colorFillQuaternary }}>
					<div className="mb-1 text-[11px] font-medium" style={{ color: token.colorTextTertiary }}>模型回答 (v005)</div>
					<div className="text-[13px]" style={{ color: token.colorTextSecondary }}>{item.modelOutput}</div>
				</div>
				<div className="flex gap-2 py-2">
					<Button size="small" type="primary">
						提交修正
					</Button>
					<Button size="small">标记无需修正</Button>
				</div>
			</Card>
		);
	};

	return (
		<BasicContent>
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">专家对齐</h2>
				<p className="mb-0 mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
					专家反馈提交、待审核样本、SFT 修正训练触发、对齐进度追踪。
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="待对齐样本真实接口不可用" />}

			{/* Summary Stats */}
			<Row gutter={16} className="mb-6">
				<Col span={6}>
					<Card
						className="flex items-center gap-4 rounded-xl border p-5"
						style={{
							borderColor: token.colorBorder,
						}}
					>
						<div
							className="flex h-11 w-11 items-center justify-center rounded-lg"
							style={{
								background: token.colorWarningBg,
								color: CHART_COLORS.warning,
							}}
						>
							<IconFileText />
						</div>
						<div>
							<div className="font-mono text-2xl font-bold">23</div>
							<div className="mt-[2px] text-xs" style={{ color: token.colorTextTertiary }}>待审核修正</div>
						</div>
					</Card>
				</Col>
				<Col span={6}>
					<Card
						className="flex items-center gap-4 rounded-xl border p-5"
						style={{
							borderColor: token.colorBorder,
						}}
					>
						<div
							className="flex h-11 w-11 items-center justify-center rounded-lg"
							style={{
								background: token.colorPrimaryBg,
								color: CHART_COLORS.primary,
							}}
						>
							<IconStar />
						</div>
						<div>
							<div className="font-mono text-2xl font-bold">156</div>
							<div className="mt-[2px] text-xs" style={{ color: token.colorTextTertiary }}>已采纳反馈</div>
						</div>
					</Card>
				</Col>
				<Col span={6}>
					<Card
						className="flex items-center gap-4 rounded-xl border p-5"
						style={{
							borderColor: token.colorBorder,
						}}
					>
						<div
							className="flex h-11 w-11 items-center justify-center rounded-lg"
							style={{
								background: token.colorSuccessBg,
								color: CHART_COLORS.success,
							}}
						>
							<IconCheck />
						</div>
						<div>
							<div className="font-mono text-2xl font-bold">3</div>
							<div className="mt-[2px] text-xs" style={{ color: token.colorTextTertiary }}>SFT 修正轮次</div>
						</div>
					</Card>
				</Col>
				<Col span={6}>
					<Card
						className="flex items-center gap-4 rounded-xl border p-5"
						style={{
							borderColor: token.colorBorder,
						}}
					>
						<div
							className="flex h-11 w-11 items-center justify-center rounded-lg"
							style={{
								background: token.colorPrimaryBg,
								color: CHART_COLORS.primary,
							}}
						>
							<IconChart />
						</div>
						<div>
							<div className="font-mono text-2xl font-bold">
								89%
							</div>
							<div className="mt-[2px] text-xs" style={{ color: token.colorTextTertiary }}>对齐通过率</div>
						</div>
					</Card>
				</Col>
			</Row>

			{/* SFT Trigger Card */}
			<Card className="mb-6 flex items-center gap-6 rounded-xl border border-[#D4BFFF] bg-[linear-gradient(135deg,#E8F0FF_0%,#E8F0FF_100%)] p-6">
				<div className="flex-1">
					<div className="mb-1 text-lg font-semibold" style={{ color: CHART_COLORS.primary }}>SFT 修正训练触发器</div>
					<div className="mb-4 text-[13px] leading-[1.6]" style={{ color: token.colorTextSecondary }}>
						当积累的专家修正样本达到阈值时，自动触发 SFT 修正训练。修正数据将与常规训练数据合并，形成更高质量的训练集。
					</div>
					<Row gutter={24}>
						<Col>
							<div className="font-mono text-[28px] font-bold">
								23
								<span className="text-sm" style={{ color: token.colorTextTertiary }}> / 50</span>
							</div>
							<div className="mt-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>修正样本 / 触发阈值</div>
						</Col>
						<Col>
							<div className="font-mono text-[28px] font-bold">
								46%
							</div>
							<div className="mt-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>阈值进度</div>
						</Col>
					</Row>
					<Progress percent={46} strokeColor="#faad14" showInfo={false} className="mt-3" />
				</div>
				<div className="flex shrink-0 flex-col gap-3">
					<Button type="primary" block>
						立即触发 SFT
					</Button>
					<Button size="small">调整阈值</Button>
				</div>
			</Card>

			{/* Tabs */}
			<Tabs
				activeKey={activeTab}
				onChange={setActiveTab}
				items={[
					{ label: "待审核 (23)", key: "pending" },
					{ label: "反馈历史", key: "history" },
					{ label: "待对齐样本", key: "samples" },
				]}
			/>

			{/* Pending Tab */}
			{
				activeTab === "pending" && (
					<Card>
						<div className="mb-4 flex items-center justify-between">
							<span className="text-base font-semibold">待审核专家反馈</span>
							<Space>
								<Button size="small">批量采纳</Button>
								<Button size="small">批量忽略</Button>
							</Space>
						</div>
						<div className="flex flex-col gap-0">
							{FEEDBACK_PENDING_DATA.map(renderPendingItem)}
						</div>
					</Card>
				)
			}

			{/* History Tab */}
			{
				activeTab === "history" && (
					<Card>
						<div className="mb-4 text-base font-semibold">已采纳反馈历史</div>
						<table className="w-full border-collapse">
							<thead>
								<tr className="border-b" style={{ borderColor: token.colorBorder }}>
									<th className="px-2 py-3 text-left text-xs font-semibold" style={{ color: token.colorTextSecondary }}>
										时间
									</th>
									<th className="px-2 py-3 text-left text-xs font-semibold" style={{ color: token.colorTextSecondary }}>
										专家
									</th>
									<th className="px-2 py-3 text-left text-xs font-semibold" style={{ color: token.colorTextSecondary }}>
										类型
									</th>
									<th className="px-2 py-3 text-left text-xs font-semibold" style={{ color: token.colorTextSecondary }}>
										摘要
									</th>
									<th className="px-2 py-3 text-left text-xs font-semibold" style={{ color: token.colorTextSecondary }}>
										SFT 轮次
									</th>
									<th className="px-2 py-3 text-left text-xs font-semibold" style={{ color: token.colorTextSecondary }}>
										状态
									</th>
								</tr>
							</thead>
							<tbody>{FEEDBACK_HISTORY_DATA.map(renderHistoryRow)}</tbody>
						</table>
					</Card>
				)
			}

			{/* Samples Tab */}
			{
				activeTab === "samples" && (
					<Row gutter={16}>
						{realSamples.length > 0 ? realSamples.map(renderSampleCard) : SAMPLES_DATA.map(renderSampleCard)}
					</Row>
				)
			}

			{/* Alignment Progress */}
			<Card>
				<div className="mb-4 text-base font-semibold">对齐进度追踪</div>
				<Row gutter={24}>
					<Col span={8}>
						<div className="mb-2 flex justify-between">
							<span className="text-[13px] font-medium">事实准确率</span>
							<span className="font-mono text-[13px]" style={{ color: CHART_COLORS.success }}>92%</span>
						</div>
						<Progress percent={92} strokeColor="#52c41a" showInfo={false} />
						<div className="mt-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>目标: 95% · 已从 78% 提升</div>
					</Col>
					<Col span={8}>
						<div className="mb-2 flex justify-between">
							<span className="text-[13px] font-medium">幻觉率</span>
							<span className="font-mono text-[13px]" style={{ color: CHART_COLORS.primary }}>7%</span>
						</div>
						<Progress percent={7} strokeColor="#1890ff" showInfo={false} railColor={token.colorBorder} />
						<div className="mt-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>目标: &lt; 5% · 已从 18% 降低</div>
					</Col>
					<Col span={8}>
						<div className="mb-2 flex justify-between">
							<span className="text-[13px] font-medium">专家满意度</span>
							<span className="font-mono text-[13px]" style={{ color: CHART_COLORS.warning }}>89%</span>
						</div>
						<Progress percent={89} strokeColor="#faad14" showInfo={false} />
						<div className="mt-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>目标: 90% · 已从 65% 提升</div>
					</Col>
				</Row>
			</Card>
		</BasicContent>
	);
}
