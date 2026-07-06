import type { DatasetStatus, TaskCategory } from "#src/api/llm-factory";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { fetchDatasetList, fetchDatasetStats } from "#src/api/llm-factory";
import { exportAnnotations } from "#src/api/llm-factory/data-productivity";
import { BasicContent } from "#src/components/basic-content";
import { BasicTable } from "#src/components/basic-table";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { DownloadOutlined } from "@ant-design/icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Input, Row, Select, Space, Statistic, Tag } from "antd";
import { useMemo, useRef, useState } from "react";

const TASK_CATEGORY_LABELS: Record<string, string> = {
	TEXT_QA: "text_qa",
	IMAGE_CAPTION: "image_caption",
	IMAGE_QA: "image_qa",
	VIDEO_QA: "video_qa",
	VIDEO_CAPTION: "video_caption",
};

const TASK_CATEGORY_COLORS: Record<string, string> = {
	TEXT_QA: "blue",
	IMAGE_CAPTION: "cyan",
	IMAGE_QA: "geekblue",
	VIDEO_QA: "purple",
	VIDEO_CAPTION: "magenta",
};

const STATUS_LABELS: Record<string, string> = {
	READY: "就绪",
	PENDING_REVIEW: "质量待审",
	FAILED: "质量不达标",
};

const STATUS_COLORS: Record<string, string> = {
	READY: "success",
	PENDING_REVIEW: "warning",
	FAILED: "error",
};

const STATUS_OPTIONS: Array<{ label: string, value: DatasetStatus }> = [
	{ label: "就绪", value: "READY" },
	{ label: "质量待审", value: "PENDING_REVIEW" },
	{ label: "质量不达标", value: "FAILED" },
];

const TASK_CATEGORY_OPTIONS: Array<{ label: string, value: TaskCategory }> = [
	{ label: "TEXT_QA", value: "TEXT_QA" },
	{ label: "IMAGE_CAPTION", value: "IMAGE_CAPTION" },
	{ label: "IMAGE_QA", value: "IMAGE_QA" },
	{ label: "VIDEO_QA", value: "VIDEO_QA" },
	{ label: "VIDEO_CAPTION", value: "VIDEO_CAPTION" },
];

function getQualityScoreColor(score: number): string {
	if (score >= 80)
		return "#52c41a"; // green
	if (score >= 60)
		return "#faad14"; // warning
	return "#ff4d4f"; // danger
}

export default function Datasets() {
	const token = useLlmTokens();
	const actionRef = useRef<ActionType>(null);

	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [keyword, setKeyword] = useState<string | undefined>();
	const [keywordInput, setKeywordInput] = useState("");
	const [status, setStatus] = useState<DatasetStatus | undefined>();
	const [taskCategory, setTaskCategory] = useState<TaskCategory | undefined>();

	const params = useMemo(() => ({ pageNo, pageSize, keyword, status, taskCategory }), [keyword, pageNo, pageSize, status, taskCategory]);

	const { data, error, isError, isLoading, refetch } = useQuery({
		queryKey: ["llm-factory", "datasets", "list", params],
		queryFn: () => fetchDatasetList(params).then(r => r.result),
		placeholderData: keepPreviousData,
	});

	const { data: stats, error: statsError, isError: isStatsError, refetch: refetchStats } = useQuery({
		queryKey: ["llm-factory", "datasets", "stats"],
		queryFn: () => fetchDatasetStats().then(r => r.result),
	});

	interface DatasetRow {
		id: string | number
		name: string
		taskCategory: string
		sampleCount: number
		version: number | string
		qualityScore: number
		status: string
		updatedAt?: string | number
	}

	const columns: ProColumns<DatasetRow>[] = [
		{
			title: "数据集",
			dataIndex: "name",
			ellipsis: true,
			render: (_, r) => <strong>{r.name}</strong>,
		},
		{
			title: "任务类型",
			dataIndex: "taskCategory",
			width: 140,
			render: (_, r) => (
				<Tag color={TASK_CATEGORY_COLORS[r.taskCategory] ?? "default"}>
					{TASK_CATEGORY_LABELS[r.taskCategory] ?? r.taskCategory}
				</Tag>
			),
		},
		{
			title: "样本数",
			dataIndex: "sampleCount",
			width: 100,
			align: "right",
			render: (_, r) => <span className="font-mono">{r.sampleCount.toLocaleString()}</span>,
		},
		{
			title: "版本",
			dataIndex: "version",
			width: 80,
			align: "center",
			render: (_, r) => (
				<span className="font-mono">
					v
					{r.version}
				</span>
			),
		},
		{
			title: "质量分",
			dataIndex: "qualityScore",
			width: 100,
			align: "right",
			render: (_, r) => (
				<span style={{ fontFamily: "monospace", fontWeight: 600, color: getQualityScoreColor(r.qualityScore) }}>
					{r.qualityScore}
				</span>
			),
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
			title: "更新时间",
			dataIndex: "updatedAt",
			width: 180,
			valueType: "dateTime",
		},
	];

	return (
		<BasicContent>
			{/* ★ P1#4: 明确两套系统定位, 消除认知混乱 */}
			<Alert
				type="info"
				showIcon
				className="mb-4"
				title="这里是运维侧的数据集编目视图"
				description={<span>标注与数据汇集请前往「智能标注 → 训练管线」（一键汇集已审核标注为训练数据集）。本页用于管理数据集元信息与统计。</span>}
			/>
			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="数据集列表真实接口不可用" />}
			{isStatsError && <QueryErrorAlert error={statsError} onRetry={() => void refetchStats()} title="数据集统计真实接口不可用" />}
			{/* Stat Cards */}
			<Row gutter={16} className="mb-4">
				<Col span={6}>
					<Card>
						<Statistic
							title="数据集总数"
							value={stats?.totalDatasets ?? 0}
							styles={{ content: { color: CHART_COLORS.primary } }}
						/>
					</Card>
				</Col>
				<Col span={6}>
					<Card>
						<Statistic
							title="总样本数"
							value={stats?.totalSamples ?? 0}
							suffix="条"
							styles={{ content: { color: CHART_COLORS.success } }}
						/>
					</Card>
				</Col>
				<Col span={6}>
					<Card>
						<Statistic
							title="版本总数"
							value={stats?.totalVersions ?? 0}
							styles={{ content: { color: CHART_COLORS.purple } }}
						/>
					</Card>
				</Col>
				<Col span={6}>
					<Card>
						<Statistic
							title="平均质量分"
							value={stats?.avgQualityScore ?? 0}
							suffix="%"
							styles={{ content: { color: token.colorWarning } }}
						/>
					</Card>
				</Col>
			</Row>

			<BasicTable<DatasetRow>
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
							placeholder="数据集名称"
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
							placeholder="任务类型"
							className="w-[140px]"
							options={TASK_CATEGORY_OPTIONS}
							value={taskCategory}
							onChange={(v) => {
								setTaskCategory(v);
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
					<Button key="create" type="primary">
						+ 新建数据集
					</Button>,
					<Button
						key="export-jsonl"
						onClick={() => exportAnnotations({ format: "jsonl" }).catch(e => window.$message?.error(e.message))}
					>
						<DownloadOutlined />
						{" "}
						导出 JSONL
					</Button>,
					<Button
						key="export-csv"
						onClick={() => exportAnnotations({ format: "csv" }).catch(e => window.$message?.error(e.message))}
					>
						<DownloadOutlined />
						{" "}
						导出 CSV
					</Button>,
				]}
			/>
		</BasicContent>
	);
}
