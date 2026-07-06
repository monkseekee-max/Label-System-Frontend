// ============================================================================
// 数据资产中心 — 高质量数据集打包导出
// ① 总览: 跨源统计 + 质量分布漏斗
// ② 数据浏览: 可筛选的高质量 QA 表
// ③ 导出: 勾选数据 → 选格式 → ZIP 下载 + 导出历史
// ============================================================================

import type { DatasetExportFormat, DatasetExportParams, DatasetPreviewItem, DatasetPreviewParams } from "#src/api/label-system";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
	DATASET_EXPORT_FORMATS,
	exportDataset,
	listDatasetExports,
	previewDataset,
} from "#src/api/label-system";
import { QueryState } from "#src/components/query-state";
import {
	CloudDownloadOutlined,
	DatabaseOutlined,
	DownloadOutlined,
	FileZipOutlined,
	HistoryOutlined,
	ReloadOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Alert,
	Badge,
	Button,
	Card,
	Col,
	Empty,
	Flex,
	Form,
	Input,
	InputNumber,
	message,
	Modal,
	Progress,
	Row,
	Select,
	Space,
	Statistic,
	Table,
	Tabs,
	Tag,
	Typography,
} from "antd";
import { useMemo, useState } from "react";

const { Paragraph, Text, Title } = Typography;

const BUCKET_COLOR: Record<string, string> = { green: "green", orange: "orange", red: "red" };
const BUCKET_LABEL: Record<string, string> = { green: "高质量", orange: "中质量", red: "低质量" };
const STATUS_LABEL: Record<string, string> = {
	reviewed_accept: "已接受",
	reviewed_edit: "已编辑",
	green_auto_skip: "自动接受",
};
const FORMAT_DESC: Record<DatasetExportFormat, string> = {
	jsonl: "原生 {instruction,input,output} — LLaMA-Factory 默认",
	alpaca: "Alpaca 格式 — 通用指令微调",
	sharegpt: "ShareGPT 多轮对话格式",
	csv: "通用 CSV — Excel/外部工具",
};

export default function DataAssetCenter() {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("overview");
	const [searchText, setSearchText] = useState("");
	const [bucketFilter, setBucketFilter] = useState<string[]>([]);
	const [pagination, setPagination] = useState<TablePaginationConfig>({ current: 1, pageSize: 10 });
	const [exportModalOpen, setExportModalOpen] = useState(false);
	const [exportForm] = Form.useForm();

	// 高质量数据集预览查询 (分页 + 分布统计)
	const previewParams: DatasetPreviewParams = useMemo(() => ({
		buckets: bucketFilter.length > 0 ? bucketFilter : undefined,
		page: pagination.current,
		page_size: pagination.pageSize,
	}), [bucketFilter, pagination]);

	const previewQuery = useQuery({
		queryKey: ["dataset-preview", previewParams],
		queryFn: () => previewDataset(previewParams),
		staleTime: 30_000,
	});

	const exportsQuery = useQuery({
		queryKey: ["dataset-exports"],
		queryFn: listDatasetExports,
		staleTime: 30_000,
	});

	const exportMutation = useMutation({
		mutationFn: (params: DatasetExportParams) => exportDataset(params),
		onSuccess: async ({ filename, blob }) => {
			// 触发浏览器下载
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			message.success(`已导出 ${filename}`);
			setExportModalOpen(false);
			await queryClient.invalidateQueries({ queryKey: ["dataset-exports"] });
		},
		onError: (err: Error) => {
			message.error(`导出失败: ${err.message}`);
		},
	});

	const data = previewQuery.data;
	const distribution = data?.distribution;
	const totalHighQuality = data?.total ?? 0;

	// 客户端二次筛选 (搜索文本, 分桶已在服务端)
	const filteredItems = useMemo(() => {
		const items = data?.items ?? [];
		if (!searchText)
			return items;
		return items.filter(it => it.question.includes(searchText) || it.answer.includes(searchText));
	}, [data, searchText]);

	const columns: ColumnsType<DatasetPreviewItem> = [
		{
			title: "问题",
			dataIndex: "question",
			ellipsis: true,
			render: (q: string) => <Text style={{ fontSize: 13 }}>{q}</Text>,
		},
		{
			title: "答案",
			dataIndex: "answer",
			ellipsis: true,
			width: "35%",
			render: (a: string) => <Text type="secondary" style={{ fontSize: 13 }}>{a}</Text>,
		},
		{
			title: "置信度",
			dataIndex: "confidence",
			width: 110,
			render: (c: number) => (
				<Progress percent={Math.round(c || 0)} size="small" status={c >= 70 ? "success" : c >= 40 ? "active" : "exception"} />
			),
		},
		{
			title: "质量",
			dataIndex: "score_bucket",
			width: 90,
			filters: [
				{ text: "高质量 (green)", value: "green" },
				{ text: "中质量 (orange)", value: "orange" },
				{ text: "低质量 (red)", value: "red" },
			],
			render: (b: string) => <Tag color={BUCKET_COLOR[b] || "default"}>{BUCKET_LABEL[b] || b}</Tag>,
		},
		{
			title: "状态",
			dataIndex: "status",
			width: 100,
			render: (s: string) => <Tag>{STATUS_LABEL[s] || s}</Tag>,
		},
	];

	// ─── 导出表单提交 ───
	const handleExportSubmit = async () => {
		try {
			const values = await exportForm.validateFields();
			await exportMutation.mutateAsync({
				buckets: bucketFilter.length > 0 ? bucketFilter : undefined,
				format: values.format,
				train_ratio: values.train_ratio ?? 0.8,
				dataset_name: values.dataset_name || "dataset",
			});
		}
		catch {
			// validateFields 失败时 antd Form 自行展示, mutation 错误已 onError 处理
		}
	};

	// ─── 总览统计卡片数据 ───
	const greenCount = distribution?.buckets?.green ?? 0;
	const orangeCount = distribution?.buckets?.orange ?? 0;
	const redCount = distribution?.buckets?.red ?? 0;
	const avgConfidence = totalHighQuality > 0
		? Math.round(filteredItems.reduce((s, it) => s + (it.confidence || 0), 0) / Math.max(filteredItems.length, 1))
		: 0;

	return (
		<div className="space-y-4">
			<Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
				<Flex align="center" gap={8}>
					<DatabaseOutlined />
					数据资产中心
				</Flex>
			</Title>
			<Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
				对高质量标注数据进行筛选、打包与导出, 生成可直接用于模型训练的数据集 (支持 JSONL / Alpaca / ShareGPT / CSV)。
			</Paragraph>

			<Tabs
				activeKey={activeTab}
				onChange={setActiveTab}
				items={[
					{
						key: "overview",
						label: (
							<span>
								<DatabaseOutlined />
								{" "}
								总览
							</span>
						),
						children: (
							<Space direction="vertical" size="large" style={{ width: "100%" }}>
								<Row gutter={[16, 16]}>
									<Col xs={12} sm={6}>
										<Card>
											<Statistic title="高质量数据" value={totalHighQuality} prefix={<Badge status="success" />} />
										</Card>
									</Col>
									<Col xs={12} sm={6}>
										<Card>
											<Statistic title="平均置信度" value={avgConfidence} suffix="%" />
										</Card>
									</Col>
									<Col xs={12} sm={6}>
										<Card>
											<Statistic title="导出次数" value={exportsQuery.data?.total ?? 0} prefix={<DownloadOutlined />} />
										</Card>
									</Col>
									<Col xs={12} sm={6}>
										<Card>
											<Statistic title="可用格式" value={4} suffix="种" prefix={<FileZipOutlined />} />
										</Card>
									</Col>
								</Row>

								<Card title="质量分布" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => previewQuery.refetch()}>刷新</Button>}>
									{previewQuery.isLoading
										? <div style={{ padding: 40 }}><Flex justify="center"><Text type="secondary">加载中...</Text></Flex></div>
										: totalHighQuality === 0
											? (
												<Empty description="暂无高质量数据">
													<Button type="primary" onClick={() => setActiveTab("browse")}>去标注数据</Button>
												</Empty>
											)
											: (
												<Row gutter={[24, 16]} align="middle">
													<Col span={16}>
														<Flex vertical gap={12}>
															<QualityBar label="高质量 (green)" count={greenCount} total={totalHighQuality} color="#52c41a" />
															<QualityBar label="中质量 (orange)" count={orangeCount} total={totalHighQuality} color="#faad14" />
															<QualityBar label="低质量 (red)" count={redCount} total={totalHighQuality} color="#ff4d4f" />
														</Flex>
													</Col>
													<Col span={8}>
														<Progress
															type="circle"
															percent={totalHighQuality > 0 ? Math.round((greenCount / totalHighQuality) * 100) : 0}
															format={p => `${p}%`}
															strokeColor="#52c41a"
														/>
														<div style={{ textAlign: "center", marginTop: 8 }}>
															<Text type="secondary" style={{ fontSize: 12 }}>高质量占比</Text>
														</div>
													</Col>
												</Row>
											)}
								</Card>

								<Card title="快速导出" extra={<CloudDownloadOutlined />}>
									<Alert
										type="info"
										showIcon
										message={`当前共 ${totalHighQuality} 条高质量数据可导出`}
										description="点击下方按钮, 选择导出格式即可打包下载 ZIP (含 train/val/metadata)。"
										style={{ marginBottom: 16 }}
									/>
									<Button
										type="primary"
										size="large"
										icon={<DownloadOutlined />}
										disabled={totalHighQuality === 0}
										onClick={() => {
											exportForm.setFieldsValue({ format: "jsonl", train_ratio: 0.8, dataset_name: "dataset" });
											setExportModalOpen(true);
										}}
									>
										打包导出数据集
									</Button>
								</Card>
							</Space>
						),
					},
					{
						key: "browse",
						label: (
							<span>
								<SearchOutlined />
								{" "}
								数据浏览
							</span>
						),
						children: (
							<Card>
								<Flex justify="space-between" align="center" wrap="wrap" gap={12} style={{ marginBottom: 16 }}>
									<Space wrap>
										<Input.Search
											placeholder="搜索问题/答案"
											allowClear
											value={searchText}
											onChange={e => setSearchText(e.target.value)}
											style={{ width: 240 }}
										/>
										<Select
											mode="multiple"
											allowClear
											placeholder="质量分桶筛选"
											value={bucketFilter}
											onChange={(v: string[]) => {
												setBucketFilter(v);
												setPagination(p => ({ ...p, current: 1 }));
											}}
											style={{ minWidth: 200 }}
											options={[
												{ label: "高质量 (green)", value: "green" },
												{ label: "中质量 (orange)", value: "orange" },
												{ label: "低质量 (red)", value: "red" },
											]}
										/>
									</Space>
									<Space>
										<Button
											icon={<DownloadOutlined />}
											disabled={totalHighQuality === 0}
											onClick={() => {
												exportForm.setFieldsValue({ format: "jsonl", train_ratio: 0.8, dataset_name: "dataset" });
												setExportModalOpen(true);
											}}
										>
											导出当前筛选
										</Button>
										<Button icon={<ReloadOutlined />} onClick={() => previewQuery.refetch()} />
									</Space>
								</Flex>

								<QueryState isLoading={previewQuery.isLoading} isError={previewQuery.isError} error={previewQuery.error} onRetry={() => previewQuery.refetch()}>
									<Table<DatasetPreviewItem>
										rowKey="id"
										columns={columns}
										dataSource={filteredItems}
										loading={previewQuery.isLoading}
										pagination={{
											...pagination,
											total: totalHighQuality,
											showSizeChanger: true,
											showTotal: t => `共 ${t} 条`,
											onChange: (current, pageSize) => setPagination({ current, pageSize }),
										}}
										size="small"
										locale={{ emptyText: <Empty description="无高质量数据" /> }}
									/>
								</QueryState>
							</Card>
						),
					},
					{
						key: "history",
						label: (
							<span>
								<HistoryOutlined />
								{" "}
								导出历史
							</span>
						),
						children: (
							<Card
								title="导出历史"
								extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => exportsQuery.refetch()}>刷新</Button>}
							>
								<QueryState isLoading={exportsQuery.isLoading} isError={exportsQuery.isError} error={exportsQuery.error} onRetry={() => exportsQuery.refetch()}>
									<Table
										rowKey="id"
										dataSource={exportsQuery.data?.items ?? []}
										loading={exportsQuery.isLoading}
										pagination={{ pageSize: 10 }}
										size="small"
										locale={{ emptyText: <Empty description="暂无导出记录" /> }}
										columns={[
											{
												title: "数据集名称",
												dataIndex: "dataset_name",
												render: (n: string | null) => n || <Text type="secondary">未命名</Text>,
											},
											{
												title: "格式",
												dataIndex: "format",
												width: 90,
												render: (f: string | null) => f ? <Tag color="blue">{f}</Tag> : "-",
											},
											{ title: "样本数", dataIndex: "item_count", width: 90 },
											{
												title: "切分",
												width: 110,
												render: (_: unknown, r: { train_count: number | null, val_count: number | null }) =>
													`${r.train_count ?? "-"}/${r.val_count ?? "-"}`,
											},
											{
												title: "指纹",
												dataIndex: "fingerprint",
												ellipsis: true,
												width: 120,
												render: (f: string | null) => f ? <Text code copyable style={{ fontSize: 11 }}>{f.slice(0, 12)}</Text> : "-",
											},
											{ title: "导出时间", dataIndex: "created_at", width: 170 },
										]}
									/>
								</QueryState>
							</Card>
						),
					},
				]}
			/>

			{/* 导出配置弹窗 */}
			<Modal
				title="打包导出数据集"
				open={exportModalOpen}
				onOk={handleExportSubmit}
				onCancel={() => setExportModalOpen(false)}
				confirmLoading={exportMutation.isPending}
				okText="导出 ZIP"
				cancelText="取消"
				width={520}
			>
				<Form form={exportForm} layout="vertical" initialValues={{ format: "jsonl", train_ratio: 0.8, dataset_name: "dataset" }}>
					<Form.Item
						name="format"
						label="导出格式"
						tooltip="选择目标训练框架兼容的格式"
					>
						<Select<DatasetExportFormat>
							options={DATASET_EXPORT_FORMATS.map(f => ({ value: f, label: `${f.toUpperCase()} — ${FORMAT_DESC[f]}` }))}
						/>
					</Form.Item>
					<Form.Item name="dataset_name" label="数据集名称">
						<Input placeholder="dataset" maxLength={60} />
					</Form.Item>
					<Form.Item name="train_ratio" label="训练集比例 (train / total)">
						<InputNumber min={0} max={1} step={0.1} style={{ width: "100%" }} />
						<Text type="secondary" style={{ fontSize: 12 }}>默认 0.8 (80% 训练, 20% 验证), val 为空时 ZIP 不含 val 文件</Text>
					</Form.Item>
					<Alert
						type="info"
						showIcon
						message={`当前筛选: 共 ${totalHighQuality} 条高质量数据`}
						style={{ marginTop: 8 }}
					/>
				</Form>
			</Modal>
		</div>
	);
}

/** 质量分布水平条 (用于总览). */
function QualityBar({ label, count, total, color }: { label: string, count: number, total: number, color: string }) {
	const percent = total > 0 ? Math.round((count / total) * 100) : 0;
	return (
		<div>
			<Flex justify="space-between" style={{ marginBottom: 4 }}>
				<Text style={{ fontSize: 13 }}>{label}</Text>
				<Text type="secondary" style={{ fontSize: 13 }}>
					{count}
					{" "}
					条 (
					{percent}
					%)
				</Text>
			</Flex>
			<Progress percent={percent} strokeColor={color} showInfo={false} size="small" />
		</div>
	);
}
