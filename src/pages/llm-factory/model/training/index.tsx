import type { TrainingStatus, TriggerMode } from "#src/api/llm-factory";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { fetchTrainingJobList } from "#src/api/llm-factory";
import { BasicContent } from "#src/components/basic-content";
import { BasicTable } from "#src/components/basic-table";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Input, Select, Space, Tag } from "antd";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

const STATUS_LABELS: Record<string, string> = {
	RUNNING: "运行中",
	COMPLETED: "已完成",
	FAILED: "失败",
	OOM: "OOM",
	PENDING: "等待中",
};

const STATUS_COLORS: Record<string, string> = {
	RUNNING: "processing",
	COMPLETED: "success",
	FAILED: "error",
	OOM: "error",
	PENDING: "default",
};

const STATUS_OPTIONS: Array<{ label: string, value: TrainingStatus }> = [
	{ label: "运行中", value: "RUNNING" },
	{ label: "已完成", value: "COMPLETED" },
	{ label: "失败", value: "FAILED" },
	{ label: "OOM", value: "OOM" },
];

const TRIGGER_MODE_LABELS: Record<string, string> = {
	AUTO: "自动",
	SEMI_AUTO: "半自动",
	MANUAL: "手动",
};

const TRIGGER_MODE_COLORS: Record<string, string> = {
	AUTO: "blue",
	SEMI_AUTO: "orange",
	MANUAL: "default",
};

const TRIGGER_MODE_OPTIONS: Array<{ label: string, value: TriggerMode }> = [
	{ label: "自动", value: "AUTO" },
	{ label: "半自动", value: "SEMI_AUTO" },
	{ label: "手动", value: "MANUAL" },
];

const GATE_COLORS: Record<string, string> = {
	PASS: "success",
	WARN: "warning",
	FAIL: "error",
};

// Pipeline progress dots (7 steps)
// 注意: 这是普通函数(非组件), 不能调用 React Hook, 颜色使用 CHART_COLORS 常量
function renderPipelineProgress(progress: number) {
	const steps = 7;
	const dots = Array.from({ length: steps }, (_, i) => {
		const isCompleted = i < progress;
		const isCurrent = i === progress - 1;

		let color = CHART_COLORS.neutral; // gray
		if (isCompleted)
			color = CHART_COLORS.success; // green
		if (isCurrent)
			color = CHART_COLORS.primary; // blue

		return (
			<Badge
				key={i}
				status={isCompleted ? "success" : "default"}
				style={{
					...(!isCompleted ? { backgroundColor: color } : {}),
					...(isCurrent ? { boxShadow: `0 0 0 2px ${color}` } : {}),
				}}
			>
				<span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: isCompleted ? color : CHART_COLORS.neutral }} />
			</Badge>
		);
	});

	return <Space size={2}>{dots}</Space>;
}

export default function TrainingList() {
	const token = useLlmTokens();
	const navigate = useNavigate();
	const actionRef = useRef<ActionType>(null);

	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [keyword, setKeyword] = useState<string | undefined>();
	const [keywordInput, setKeywordInput] = useState("");
	const [status, setStatus] = useState<TrainingStatus | undefined>();
	const [triggerMode, setTriggerMode] = useState<TriggerMode | undefined>();

	const params = useMemo(() => ({ pageNo, pageSize, keyword, status, triggerMode }), [keyword, pageNo, pageSize, status, triggerMode]);

	const { data, error, isError, isLoading, refetch } = useQuery({
		queryKey: ["llm-factory", "training", "list", params],
		queryFn: () => fetchTrainingJobList(params).then(r => r.result),
	});

	interface TrainingTaskRow {
		id: string | number
		runId: string
		triggerMode: string
		baseModel: string
		loraConfig: string
		dataSize: number
		status: string
		pipelineProgress: number
		gateResult: string
		duration: number | string
		completedAt?: string | number
	}

	const columns: ProColumns<TrainingTaskRow>[] = [
		{
			title: "Run ID",
			dataIndex: "runId",
			width: 150,
			render: (_, r) => (
				<Button
					type="link"
					size="small"
					style={{ fontFamily: "monospace", padding: 0 }}
					onClick={() => void navigate(`/llm-factory/model/training/${r.id}`)}
				>
					{r.runId}
				</Button>
			),
		},
		{
			title: "触发模式",
			dataIndex: "triggerMode",
			width: 100,
			render: (_, r) => (
				<Tag color={TRIGGER_MODE_COLORS[r.triggerMode] ?? "default"}>
					{TRIGGER_MODE_LABELS[r.triggerMode] ?? r.triggerMode}
				</Tag>
			),
		},
		{
			title: "基座模型",
			dataIndex: "baseModel",
			width: 140,
		},
		{
			title: "LoRA 配置",
			dataIndex: "loraConfig",
			width: 120,
		},
		{
			title: "数据量",
			dataIndex: "dataSize",
			width: 100,
			align: "right",
			render: (_, r) => <span className="font-mono">{r.dataSize.toLocaleString()}</span>,
		},
		{
			title: "状态",
			dataIndex: "status",
			width: 100,
			render: (_, r) => (
				<Tag color={STATUS_COLORS[r.status] ?? "default"}>
					{STATUS_LABELS[r.status] ?? r.status}
				</Tag>
			),
		},
		{
			title: "流水线进度",
			dataIndex: "pipelineProgress",
			width: 180,
			render: (_, r) => renderPipelineProgress(r.pipelineProgress),
		},
		{
			title: "门禁",
			dataIndex: "gateResult",
			width: 80,
			render: (_, r) => <Tag color={GATE_COLORS[r.gateResult] ?? "default"}>{r.gateResult}</Tag>,
		},
		{
			title: "耗时",
			dataIndex: "duration",
			width: 80,
			align: "right",
			render: (_, r) => (
				<span className="font-mono">
					{r.duration}
					min
				</span>
			),
		},
		{
			title: "完成时间",
			dataIndex: "completedAt",
			width: 180,
			valueType: "dateTime",
		},
		{
			title: "操作",
			valueType: "option",
			width: 120,
			fixed: "right",
			render: (_, r) => [
				<Button
					key="detail"
					type="link"
					size="small"
					onClick={() => void navigate(`/llm-factory/model/training/${r.id}`)}
				>
					详情
				</Button>,
				<Button
					key="log"
					type="link"
					size="small"
				>
					日志
				</Button>,
			],
		},
	];

	return (
		<BasicContent>
			{/* ★ P1#4: 明确两套系统定位 */}
			<Alert
				type="info"
				showIcon
				className="mb-4"
				title="训练任务运维视图"
				description={<span>若需从标注数据启动训练，请前往「智能标注 → 训练管线」。本页用于监控与管理已提交的训练流水线任务。</span>}
			/>
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">训练任务</h2>
				<p style={{ margin: "4px 0 0 0", color: token.colorTextSecondary, fontSize: 14 }}>
					7 步标准化流水线：数据摄入 → 标注 → 质量过滤 → SFT 训练 → 评测 → 部署 → 推理
				</p>
			</div>
			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="训练任务真实接口不可用" />}
			<BasicTable<TrainingTaskRow>
				actionRef={actionRef}
				rowKey="id"
				loading={isLoading}
				dataSource={data?.records}
				columns={columns}
				search={false}
				pagination={{
					current: pageNo,
					pageSize,
					total: data?.total ?? 0,
					showSizeChanger: true,
					onChange: (page, size) => {
						setPageNo(page);
						setPageSize(size);
					},
				}}
				toolBarRender={() => [
					<Space key="filters" wrap>
						<Input.Search
							placeholder="搜索 Run ID"
							allowClear
							className="w-[200px]"
							value={keywordInput}
							onChange={e => setKeywordInput(e.target.value)}
							onSearch={(v) => {
								setKeyword(v || undefined);
								setPageNo(1);
							}}
						/>
						<Select
							allowClear
							placeholder="全部状态"
							className="w-[120px]"
							options={STATUS_OPTIONS}
							value={status}
							onChange={(v) => {
								setStatus(v);
								setPageNo(1);
							}}
						/>
						<Select
							allowClear
							placeholder="全部模式"
							className="w-[120px]"
							options={TRIGGER_MODE_OPTIONS}
							value={triggerMode}
							onChange={(v) => {
								setTriggerMode(v);
								setPageNo(1);
							}}
						/>
					</Space>,
					<Button
						key="create"
						type="primary"
						onClick={() => void navigate("/llm-factory/model/training/create")}
					>
						新建训练
					</Button>,
				]}
			/>
		</BasicContent>
	);
}
