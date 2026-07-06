import type { PipelineSource, PipelineStatus } from "#src/api/llm-factory";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { fetchPipelineRunList, fetchPipelineStats } from "#src/api/llm-factory";
import { BasicContent } from "#src/components/basic-content";
import { BasicTable } from "#src/components/basic-table";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { CheckCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Badge, Card, Col, Row, Select, Space, Statistic, Steps, Tag } from "antd";
import { useMemo, useRef, useState } from "react";

const SOURCE_LABELS: Record<string, string> = {
	API: "API推送",
	UPLOAD: "文件上传",
	DVC: "DVC同步",
};

const STATUS_LABELS: Record<string, string> = {
	COMPLETED: "完成",
	PARTIAL_FAILED: "部分失败",
};

const STATUS_COLORS: Record<string, string> = {
	COMPLETED: "success",
	PARTIAL_FAILED: "warning",
};

const SOURCE_OPTIONS: Array<{ label: string, value: PipelineSource }> = [
	{ label: "API推送", value: "API" },
	{ label: "文件上传", value: "UPLOAD" },
	{ label: "DVC同步", value: "DVC" },
];

const STATUS_OPTIONS: Array<{ label: string, value: PipelineStatus }> = [
	{ label: "完成", value: "COMPLETED" },
	{ label: "部分失败", value: "PARTIAL_FAILED" },
];

// Pipeline steps for visualization
const PIPELINE_STEPS = [
	{ title: "数据摄入", content: "接入数据源" },
	{ title: "Label Studio 标注", content: "人工标注" },
	{ title: "质量过滤", content: "自动质检" },
	{ title: "SFT/PEFT 训练", content: "模型微调" },
	{ title: "基准评测", content: "效果评估" },
	{ title: "模型注册 & 部署", content: "版本管理" },
	{ title: "推理 & 反馈", content: "闭环优化" },
];

export default function DataPipeline() {
	const token = useLlmTokens();
	const actionRef = useRef<ActionType>(null);

	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [source, setSource] = useState<PipelineSource | undefined>();
	const [status, setStatus] = useState<PipelineStatus | undefined>();

	const params = useMemo(() => ({ pageNo, pageSize, source, status }), [pageNo, pageSize, source, status]);

	const { data, error, isError, isLoading, refetch } = useQuery({
		queryKey: ["llm-factory", "pipeline", "list", params],
		queryFn: () => fetchPipelineRunList(params).then(r => r.result),
		placeholderData: keepPreviousData,
	});

	const { data: stats, error: statsError, isError: isStatsError, refetch: refetchStats } = useQuery({
		queryKey: ["llm-factory", "pipeline", "stats"],
		queryFn: () => fetchPipelineStats().then(r => r.result),
	});

	interface PipelineRunRow {
		id: string | number
		source: string
		recordCount: number
		status: string
		duration: number | string
		completedAt?: string | number
	}

	const columns: ProColumns<PipelineRunRow>[] = [
		{
			title: "管道 ID",
			dataIndex: "id",
			width: 140,
			render: (_, r) => <span className="font-mono">{r.id}</span>,
		},
		{
			title: "来源",
			dataIndex: "source",
			width: 120,
			render: (_, r) => SOURCE_LABELS[r.source] ?? r.source,
		},
		{
			title: "记录数",
			dataIndex: "recordCount",
			width: 100,
			align: "right",
			render: (_, r) => <span className="font-mono">{r.recordCount.toLocaleString()}</span>,
		},
		{
			title: "状态",
			dataIndex: "status",
			width: 120,
			render: (_, r) => (
				<Tag color={STATUS_COLORS[r.status] ?? "default"}>
					{STATUS_LABELS[r.status] ?? r.status}
				</Tag>
			),
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
	];

	// Pipeline step status (mock: first 3 done, 4th running)
	const getStepStatus = (index: number) => {
		if (index < 3)
			return "finish";
		if (index === 3)
			return "process";
		return "wait";
	};

	const getStepIcon = (index: number) => {
		const status = getStepStatus(index);
		if (status === "finish")
			return <CheckCircleOutlined />;
		if (status === "process")
			return <LoadingOutlined />;
		return undefined;
	};

	return (
		<BasicContent>
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">数据管道</h2>
				<p style={{ margin: "4px 0 0 0", color: token.colorTextSecondary, fontSize: 14 }}>
					3 大数据摄入入口 + 7 步自动化处理流程
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="管道运行记录真实接口不可用" />}
			{isStatsError && <QueryErrorAlert error={statsError} onRetry={() => void refetchStats()} title="管道统计真实接口不可用" />}

			{/* Ingest Source Cards */}
			<Row gutter={16} className="mb-6">
				<Col span={8}>
					<Card
						hoverable
						style={{
							borderTop: "3px solid #1890ff",
							position: "relative",
							overflow: "hidden",
						}}
					>
						<div className="text-base font-semibold mb-2">API 推送</div>
						<div style={{ color: token.colorTextSecondary, fontSize: 13, marginBottom: 16 }}>
							REST API Q&A 数据推送接口
						</div>
						<Row gutter={16}>
							<Col span={12}>
								<Statistic title="今日摄入" value={stats?.apiTodayCount ?? 0} suffix="条" styles={{ content: { fontSize: 20 } }} />
							</Col>
							<Col span={12}>
								<Statistic
									title="队列"
									value={stats?.apiQueueSize ?? 0}
									styles={{ content: { fontSize: 20 } }}
									prefix={
										<Badge status={stats?.apiStatus === "RUNNING" ? "processing" : "default"} />
									}
								/>
							</Col>
						</Row>
					</Card>
				</Col>
				<Col span={8}>
					<Card
						hoverable
						style={{
							borderTop: "3px solid #13c2c2",
							position: "relative",
							overflow: "hidden",
						}}
					>
						<div className="text-base font-semibold mb-2">文件上传</div>
						<div style={{ color: token.colorTextSecondary, fontSize: 13, marginBottom: 16 }}>
							JSONL / CSV / Parquet 批量上传
						</div>
						<Row gutter={16}>
							<Col span={12}>
								<Statistic title="批次" value={stats?.uploadBatchCount ?? 0} styles={{ content: { fontSize: 20 } }} />
							</Col>
							<Col span={12}>
								<Statistic title="待处理" value={stats?.uploadPending ?? 0} styles={{ content: { fontSize: 20 } }} />
							</Col>
						</Row>
					</Card>
				</Col>
				<Col span={8}>
					<Card
						hoverable
						style={{
							borderTop: "3px solid #722ed1",
							position: "relative",
							overflow: "hidden",
						}}
					>
						<div className="text-base font-semibold mb-2">DVC 同步</div>
						<div style={{ color: token.colorTextSecondary, fontSize: 13, marginBottom: 16 }}>
							DVC Remote 数据集同步
						</div>
						<Row gutter={16}>
							<Col span={12}>
								<Statistic
									title="已同步"
									value={stats?.dvcSyncedCount ?? 0}
									suffix="条"
									styles={{ content: { fontSize: 20 } }}
								/>
							</Col>
							<Col span={12}>
								<Statistic
									title="上次同步"
									value={stats?.dvcLastSync ?? "-"}
									styles={{ content: { fontSize: 16, fontWeight: "normal" } }}
								/>
							</Col>
						</Row>
					</Card>
				</Col>
			</Row>

			{/* Pipeline Visualization */}
			<Card className="mb-4">
				<div className="text-base font-semibold mb-4">处理流程</div>
				<Steps
					current={3}
					items={PIPELINE_STEPS.map((step, index) => ({
						title: step.title,
						content: step.content,
						status: getStepStatus(index),
						icon: getStepIcon(index),
					}))}
				/>
			</Card>

			{/* Pipeline Runs Table */}
			<BasicTable<PipelineRunRow>
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
						<Select
							allowClear
							placeholder="数据来源"
							className="w-[140px]"
							options={SOURCE_OPTIONS}
							value={source}
							onChange={(v) => {
								setSource(v);
								setPageNo(1);
							}}
						/>
						<Select
							allowClear
							placeholder="状态"
							className="w-[120px]"
							options={STATUS_OPTIONS}
							value={status}
							onChange={(v) => {
								setStatus(v);
								setPageNo(1);
							}}
						/>
					</Space>,
				]}
			/>
		</BasicContent>
	);
}
