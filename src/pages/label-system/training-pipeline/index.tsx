// ============================================================================
// 训练管线 (ADR-014 整合 — 源 TrainingPipeline)
// 标注审核通过 → 汇集数据集 → 训练任务 → 运行 → 模型产出 → 部署
// ★ 打通标注→训练流程: 显示已审核QA数量, 一键汇集数据集
// ============================================================================

import type { TrainedModel, TrainingJob } from "#src/api/label-system";
import type { ColumnsType } from "antd/es/table";
import {
	createReviewedDataset,
	createTrainingJob,
	fetchTrainedModels,
	fetchTrainingDatasets,
	fetchTrainingJobs,
	listQAItems,
	runTrainingJob,
} from "#src/api/label-system";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { integer, maxLength, minLength, range, required, tokenName } from "#src/utils/validation";
import { CloudUploadOutlined, FileSearchOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, RocketOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Empty, Form, InputNumber, Modal, Progress, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const { Text, Paragraph } = Typography;
const STATUS_COLOR: Record<string, string> = {
	pending: "default",
	running: "processing",
	completed: "green",
	failed: "red",
	deployed: "success",
	ready: "blue",
	reviewed_accept: "green",
};

export default function TrainingPipeline() {
	const { t } = useTranslation();
	const token = useLlmTokens();
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [jobForm] = Form.useForm();

	const dsQuery = useQuery({ queryKey: ["ls-datasets"], queryFn: fetchTrainingDatasets });
	const jobsQuery = useQuery({ queryKey: ["ls-jobs"], queryFn: fetchTrainingJobs });
	const modelsQuery = useQuery({ queryKey: ["ls-models"], queryFn: fetchTrainedModels });
	// ★ 查询已审核通过的标注项 (数据飞轮来源)
	const reviewedQuery = useQuery({
		queryKey: ["ls-reviewed-qa"],
		queryFn: () => listQAItems({ status: "reviewed_accept", page_size: 20 }),
		refetchInterval: 10000,
	});

	const datasets = dsQuery.data?.items ?? [];
	const jobs = jobsQuery.data?.items ?? [];
	const models = modelsQuery.data?.items ?? [];
	const reviewedQA = reviewedQuery.data?.items ?? [];
	const reviewedCount = reviewedQuery.data?.total ?? reviewedQA.length;

	const createDsMutation = useMutation({
		// 修复: 页面语义是"从已审核标注汇集" (QAItem status=reviewed_accept),
		// 应走 from-reviewed-qa 端点; 原误用 from-approved (查 DataAsset.approved) 导致 400.
		mutationFn: (payload: { name: string }) => createReviewedDataset(payload),
		onSuccess: (data) => {
			window.$message?.success(`数据集已创建，汇集 ${data.item_count ?? reviewedCount} 条已审核标注`);
			queryClient.invalidateQueries({ queryKey: ["ls-datasets"] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "创建失败"),
	});

	const createJobMutation = useMutation({
		mutationFn: (payload: { dataset_id: string, base_model: string, epochs?: number }) => createTrainingJob(payload),
		onSuccess: () => {
			window.$message?.success("训练任务已创建");
			queryClient.invalidateQueries({ queryKey: ["ls-jobs"] });
			setCreateOpen(false);
			jobForm.resetFields();
		},
		onError: (e: any) => window.$message?.error(e?.message || "创建失败"),
	});

	const runMutation = useMutation({
		mutationFn: (id: string) => runTrainingJob(id),
		onSuccess: () => {
			window.$message?.success("训练任务已启动");
			queryClient.invalidateQueries({ queryKey: ["ls-jobs"] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "启动失败"),
	});

	const jobColumns: ColumnsType<TrainingJob> = [
		{ title: "基座模型", dataIndex: "base_model", ellipsis: true },
		{ title: "状态", dataIndex: "status", width: 100, render: (v: string) => <Tag color={STATUS_COLOR[v] || "default"}>{v}</Tag> },
		{
			title: "进度",
			dataIndex: "progress",
			width: 160,
			render: (v?: number) => (v != null ? <Progress percent={v} size="small" /> : "-"),
		},
		{ title: "创建时间", dataIndex: "created_at", width: 170, render: (v: string) => (v ? new Date(v).toLocaleString("zh-CN") : "-") },
		{
			title: "操作",
			width: 120,
			render: (_, r) => (
				<Button
					size="small"
					type="primary"
					icon={<PlayCircleOutlined />}
					loading={runMutation.isPending}
					disabled={r.status === "running" || r.status === "completed"}
					onClick={() => runMutation.mutate(r.id)}
				>
					运行
				</Button>
			),
		},
	];

	const modelColumns: ColumnsType<TrainedModel> = [
		{ title: "模型名称", dataIndex: "name", ellipsis: true },
		{ title: "基座", dataIndex: "base_model", width: 140 },
		{ title: "状态", dataIndex: "status", width: 100, render: (v: string) => <Tag color={STATUS_COLOR[v] || "default"}>{v}</Tag> },
		{
			title: "指标",
			dataIndex: "metrics",
			render: (m: Record<string, number> | undefined, r: TrainedModel) => {
				// PM诚实化: demo 任务标示例, 真实任务显 train_loss, 空显待评估
				if (r.training_source === "demo")
					return <Tag color="default">示例（演示训练，无真实指标）</Tag>;
				if (m && Object.keys(m).length > 0) {
					return (
						<Space size={4} wrap>
							{Object.entries(m).slice(0, 3).map(([k, v]) => (
								<Tag key={k} color={k === "train_loss" ? "green" : "blue"}>
									{k === "train_loss" ? `train_loss=${v.toFixed(4)}` : `${k}: ${(v * 100).toFixed(1)}%`}
								</Tag>
							))}
						</Space>
					);
				}
				return r.status === "queued" || r.status === "running" ? <Tag color="processing">训练中</Tag> : <Tag>待评估</Tag>;
			},
		},
	];

	const cardStyle = { background: token.colorBgContainer, borderRadius: 12 };
	const subBg = token.colorFillQuaternary;

	return (
		<Space orientation="vertical" size={16} className="w-full">
			{/* ★ 流程引导: 标注→训练的数据飞轮闭环说明 */}
			<Card variant="borderless" style={{ background: token.colorPrimaryBg }}>
				<Row gutter={[16, 12]} align="middle">
					<Col xs={24} lg={14}>
						<Space align="start">
							<RocketOutlined style={{ fontSize: 28, color: token.colorPrimary, marginTop: 4 }} />
							<div>
								<Text strong className="text-base">训练管线 · 数据飞轮闭环</Text>
								<Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4, fontSize: 13 }}>
									标注工作台审核通过的标注 → 汇集为训练数据集 → 训练任务 → 模型产出。当前可汇集
									{" "}
									<Text strong style={{ color: token.colorSuccess }}>{reviewedCount}</Text>
									{" "}
									条已审核标注。
								</Paragraph>
							</div>
						</Space>
					</Col>
					<Col xs={24} lg={10}>
						<Space orientation="vertical" size={6} className="w-full">
							{reviewedCount === 0
								? (
									<Alert
										type="warning"
										showIcon
										title="暂无可汇集的已审核标注"
										description="请先到「文本标注」工作台对标注项执行提交审核 + 审核通过"
									/>
								)
								: (
									<Alert
										type="success"
										showIcon
										title={`可汇集 ${reviewedCount} 条已审核标注`}
										description="点击下方「从已审核标注创建」即可汇集为训练数据集"
									/>
								)}
						</Space>
					</Col>
				</Row>
			</Card>

			<Row gutter={[16, 16]}>
				<Col xs={12} lg={6}>
					<Card variant="borderless" style={cardStyle}>
						<Statistic title={<Tooltip title="已审核通过(reviewed_accept)的标注，可进入训练"><span>可汇集标注</span></Tooltip>} value={reviewedCount} prefix={<FileSearchOutlined />} styles={{ content: { color: token.colorSuccess } }} />
					</Card>
				</Col>
				<Col xs={12} lg={6}>
					<Card variant="borderless" style={cardStyle}>
						<Statistic title="数据集" value={datasets.length} prefix={<CloudUploadOutlined />} />
					</Card>
				</Col>
				<Col xs={12} lg={6}>
					<Card variant="borderless" style={cardStyle}>
						<Statistic title="训练任务" value={jobs.length} prefix={<RocketOutlined />} styles={{ content: { color: token.colorWarning } }} />
					</Card>
				</Col>
				<Col xs={12} lg={6}>
					<Card variant="borderless" style={cardStyle}>
						<Statistic title="产出模型" value={models.length} styles={{ content: { color: token.colorSuccess } }} />
					</Card>
				</Col>
			</Row>

			<Card
				variant="borderless"
				title={(
					<Space>
						<CloudUploadOutlined />
						<span>数据集（已审核标注汇集）</span>
						{reviewedCount > 0 && (
							<Tag color="success">
								{reviewedCount}
								{" "}
								条可汇集
							</Tag>
						)}
					</Space>
				)}
				extra={(
					<Space>
						<Button
							type={reviewedCount > 0 ? "primary" : "default"}
							icon={<PlusOutlined />}
							onClick={() => {
								const existCount = dsQuery.data?.items?.length ?? 0;
								window.$modal?.confirm({
									title: "汇集训练数据集",
									content: `将创建新数据集并汇集 ${reviewedCount} 条已审核标注。${existCount > 0 ? `当前已有 ${existCount} 个数据集，重复创建会产生冗余。` : ""}确认继续？`,
									onOk: () => createDsMutation.mutate({ name: `数据集-${new Date().toLocaleString("zh-CN").slice(5, 16)}` }),
								});
							}}
							loading={createDsMutation.isPending}
							disabled={reviewedCount === 0}
						>
							从已审核标注创建
							{" "}
							{reviewedCount > 0 ? `(${reviewedCount}条)` : ""}
						</Button>
						<Button icon={<ReloadOutlined />} onClick={() => { dsQuery.refetch(); reviewedQuery.refetch(); }} />
					</Space>
				)}
			>
				{reviewedCount > 0 && datasets.length === 0 && (
					<Alert
						className="mb-3"
						type="info"
						showIcon
						icon={<ThunderboltOutlined />}
						message="下一步: 点击「从已审核标注创建」汇集数据集"
						description={`当前有 ${reviewedCount} 条已审核通过的标注项等待汇集为训练数据集`}
					/>
				)}
				<Table
					columns={[
						{ title: "名称", dataIndex: "name", ellipsis: true },
						{ title: "条目数", dataIndex: "item_count", width: 100, render: (v: number) => (
							<Tag color="blue">
								{v}
								{" "}
								条
							</Tag>
						) },
						{ title: "状态", dataIndex: "status", width: 100, render: (v: string) => <Tag color={STATUS_COLOR[v] || "default"}>{v}</Tag> },
						{ title: "创建时间", dataIndex: "created_at", width: 170, render: (v: string) => (v ? new Date(v).toLocaleString("zh-CN") : "-") },
					]}
					dataSource={datasets}
					rowKey="id"
					loading={dsQuery.isLoading}
					pagination={{ pageSize: 5 }}
					locale={{ emptyText: <Empty description="暂无数据集，请先汇集已审核标注" /> }}
				/>
			</Card>

			<Card
				variant="borderless"
				title="训练任务"
				extra={(
					<Space>
						<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} disabled={datasets.length === 0}>
							新建训练任务
						</Button>
						<Button icon={<ReloadOutlined />} onClick={() => jobsQuery.refetch()} />
					</Space>
				)}
			>
				{datasets.length > 0 && jobs.length === 0 && (
					<Alert
						className="mb-3"
						type="info"
						showIcon
						title="下一步: 新建训练任务"
						description="选择已汇集的数据集，配置基座模型和训练轮数后启动训练"
					/>
				)}
				<Table columns={jobColumns} dataSource={jobs} rowKey="id" loading={jobsQuery.isLoading} pagination={{ pageSize: 5 }} locale={{ emptyText: <Empty description="暂无训练任务" /> }} />
			</Card>

			<Card variant="borderless" title="产出模型" extra={<Button icon={<ReloadOutlined />} onClick={() => modelsQuery.refetch()} />}>
				<Table columns={modelColumns} dataSource={models} rowKey="id" loading={modelsQuery.isLoading} pagination={{ pageSize: 5 }} locale={{ emptyText: <Empty description="暂无模型" /> }} />
			</Card>

			<Modal title="新建训练任务" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => jobForm.submit()} okButtonProps={{ loading: createJobMutation.isPending }}>
				<Form
					form={jobForm}
					layout="vertical"
					onFinish={v => createJobMutation.mutate({ dataset_id: v.dataset_id, base_model: v.base_model, epochs: v.epochs })}
				>
					<Form.Item name="dataset_id" label="数据集" rules={[required()]}>
						<Select
							placeholder="选择数据集"
							options={datasets.map(d => ({ value: d.id, label: `${d.name} (${d.item_count}条)` }))}
						/>
					</Form.Item>
					<Form.Item name="base_model" label="基座模型" rules={[required(), minLength(3), maxLength(64), tokenName()]} initialValue="qwen3-8b">
						<Select
							options={[
								{ value: "qwen3-8b", label: "qwen3-8b (本地)" },
								{ value: "glm-4-plus", label: "glm-4-plus (智谱)" },
								{ value: "qwen-plus", label: "qwen-plus (通义)" },
							]}
						/>
					</Form.Item>
					<Form.Item name="epochs" label="训练轮数" initialValue={3} rules={[required(), integer(), range(1, 20, t("form.validation.epochsRange", { defaultValue: "训练轮数需为 1 到 20" }))]}>
						<InputNumber min={1} max={20} className="w-full" />
					</Form.Item>
				</Form>
			</Modal>
		</Space>
	);
}
