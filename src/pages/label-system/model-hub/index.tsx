// ============================================================================
// 模型中心 (ADR-014 整合 — 源 ModelHub)
// 训练产出的模型列表 + 一键部署到 vLLM
// ============================================================================

import type { TrainedModel } from "#src/api/label-system";
import type { ColumnsType } from "antd/es/table";
import { deployModel, fetchTrainedModels } from "#src/api/label-system";
import { QueryState } from "#src/components/query-state";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { BarChartOutlined, CloudServerOutlined, MessageOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Empty, Modal, Progress, Space, Statistic, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";

const { Paragraph, Text } = Typography;

export default function ModelHub() {
	const token = useLlmTokens();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [metricsModal, setMetricsModal] = useState<TrainedModel | null>(null);

	const modelsQuery = useQuery({ queryKey: ["ls-models"], queryFn: fetchTrainedModels });
	const models = modelsQuery.data?.items ?? [];

	const deployMutation = useMutation({
		mutationFn: ({ id, name, prefill }: { id: string, name?: string, prefill?: boolean }) => deployModel(id, { name, set_as_prefill_model: prefill }),
		onSuccess: () => {
			window.$message?.success("模型已部署为推理服务");
			queryClient.invalidateQueries({ queryKey: ["ls-models"] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "部署失败"),
	});

	const columns: ColumnsType<TrainedModel> = [
		{ title: "模型名称", dataIndex: "name", ellipsis: true, render: (v: string, r: TrainedModel) => (
			<Space>
				<Text strong>{v}</Text>
				{r.is_prefill_model && <Tag color="gold">预填</Tag>}
			</Space>
		) },
		{ title: "基座", dataIndex: "base_model", width: 140 },
		{
			title: "状态",
			dataIndex: "status",
			width: 110,
			render: (v: string) => (
				<Badge status={v === "deployed" ? "success" : v === "ready" ? "processing" : "default"} text={v === "deployed" ? "已部署" : v === "ready" ? "就绪" : v} />
			),
		},
		{
			title: "能力对齐",
			dataIndex: "metrics",
			width: 120,
			render: (m?: Record<string, number>) => {
				if (!m)
					return "-";
				const acc = m.accuracy || m.alignment_score || 0;
				return (
					<Text style={{ color: acc > 0.9 ? token.colorSuccess : token.colorWarning, fontWeight: 600 }}>
						{(acc * 100).toFixed(1)}
						%
					</Text>
				);
			},
		},
		{
			title: "操作",
			width: 280,
			render: (_, r) => (
				<Space orientation="vertical" size={4} className="w-full">
					<Space>
						<Button size="small" icon={<BarChartOutlined />} onClick={() => setMetricsModal(r)}>指标</Button>
						{r.status !== "deployed" && (
							<Button
								size="small"
								type="primary"
								icon={<CloudServerOutlined />}
								loading={deployMutation.isPending}
								onClick={() => deployMutation.mutate({ id: r.artifact_id, name: r.name, prefill: true })}
							>
								部署+设为预填
							</Button>
						)}
					</Space>
					{r.status !== "deployed" && (
						<Button size="small" type="link" loading={deployMutation.isPending} onClick={() => deployMutation.mutate({ id: r.artifact_id, name: r.name, prefill: false })}>
							仅部署 (不设为预填)
						</Button>
					)}
					{r.status === "deployed" && (
						<Button size="small" type="link" onClick={() => navigate("/llm-factory/knowledge/chat")}>
							<MessageOutlined />
							{" "}
							去对话测试
						</Button>
					)}
				</Space>
			),
		},
	];

	return (
		<Space orientation="vertical" size={16} className="w-full">
			<Card variant="borderless" style={{ background: token.colorPrimaryBg }}>
				<Space>
					<CloudServerOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
					<div>
						<Typography.Title level={4} className="mb-0">
							模型中心
						</Typography.Title>
						<Paragraph type="secondary" className="mb-0">
							训练达标的模型可一键部署为推理服务，供智能问答和多模态对话使用。
						</Paragraph>
					</div>
				</Space>
			</Card>

			<Card variant="borderless">
				<Space>
					<Statistic title="总模型数" value={models.length} />
					<Statistic title="已部署" value={models.filter(m => m.status === "deployed").length} styles={{ content: { color: token.colorSuccess } }} />
					<Button icon={<ReloadOutlined />} onClick={() => modelsQuery.refetch()}>
						刷新
					</Button>
				</Space>
			</Card>

			<Card variant="borderless">
				<QueryState
					isLoading={modelsQuery.isLoading}
					isError={modelsQuery.isError}
					isEmpty={models.length === 0}
					error={modelsQuery.error}
					onRetry={() => modelsQuery.refetch()}
					emptyText="暂无模型，请先在训练管线产出模型"
				>
					<Table
						columns={columns}
						dataSource={models}
						rowKey="id"
						pagination={{ pageSize: 10 }}
					/>
				</QueryState>
			</Card>

			<Modal title={`${metricsModal?.name} — 能力指标`} open={!!metricsModal} onCancel={() => setMetricsModal(null)} footer={null}>
				{metricsModal && (
					<Space orientation="vertical" size={16} className="w-full">
						<Card size="small" variant="borderless">
							<Space size={32} wrap>
								<div>
									<Text type="secondary" className="text-xs">基座模型</Text>
									<div><Text strong>{metricsModal.base_model || "-"}</Text></div>
								</div>
								<div>
									<Text type="secondary" className="text-xs">状态</Text>
									<div><Text strong>{metricsModal.status === "deployed" ? "已部署" : metricsModal.status}</Text></div>
								</div>
								<div>
									<Text type="secondary" className="text-xs">创建时间</Text>
									<div><Text strong>{metricsModal.created_at ? new Date(metricsModal.created_at).toLocaleString("zh-CN") : "-"}</Text></div>
								</div>
							</Space>
						</Card>
						{metricsModal.metrics && Object.keys(metricsModal.metrics).length > 0
							? (
								<>
									<div className="mt-1"><Text strong className="text-sm">训练指标</Text></div>
									{Object.entries(metricsModal.metrics).map(([k, v]) => (
										<div key={k}>
											<Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 4 }}>
												<Text>{k}</Text>
												<Text strong>
													{(v * 100).toFixed(1)}
													%
												</Text>
											</Space>
											<Progress percent={Math.round(v * 100)} strokeColor={v > 0.9 ? token.colorSuccess : token.colorWarning} />
										</div>
									))}
								</>
							)
							: (
								<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该模型暂无训练指标（训练未产出或未评测）" style={{ margin: "16px 0" }} />
							)}
						<Paragraph type="secondary" className="mt-2">
							部署后，该模型将自动接入推理服务，智能问答和多模态对话会自动调用。
						</Paragraph>
					</Space>
				)}
			</Modal>
		</Space>
	);
}
