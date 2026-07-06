// ============================================================================
// 智能标注仪表板 (ADR-014 整合 — 源 Dashboard)
// 数据飞轮全景: 资产 → QA标注 → 训练任务 → 模型部署
// ============================================================================

import type { TrainingJob } from "#src/api/label-system";
import type { CSSProperties } from "react";
import { fetchAssets, fetchPlatformOverview, fetchTrainedModels, fetchTrainingJobs, listQAItems } from "#src/api/label-system";
import { EmptyState } from "#src/components/empty-state";
import { QueryState } from "#src/components/query-state";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import {
	CheckCircleOutlined,
	CloseCircleOutlined,
	DatabaseOutlined,
	DeploymentUnitOutlined,
	FileTextOutlined,
	LoadingOutlined,
	RadarChartOutlined,
	ReloadOutlined,
	RocketOutlined,
	ThunderboltOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Progress, Row, Space, Statistic, Tag, Tooltip, Typography } from "antd";
import { useNavigate } from "react-router";

const { Paragraph, Title } = Typography;

/** 根据训练任务状态返回图标 + 主色 (避免失败任务也显示对勾). */
function jobStatusVisual(status: string, token: ReturnType<typeof useLlmTokens>) {
	switch (status) {
		case "completed":
			return { icon: <CheckCircleOutlined />, color: token.colorSuccess, tagColor: "green" as const };
		case "running":
			return { icon: <LoadingOutlined />, color: token.colorInfo, tagColor: "processing" as const };
		case "failed":
			return { icon: <CloseCircleOutlined />, color: token.colorError, tagColor: "red" as const };
		case "cancelled":
			return { icon: <CloseCircleOutlined />, color: token.colorTextTertiary, tagColor: "default" as const };
		default:
			return { icon: <RocketOutlined />, color: token.colorWarning, tagColor: "default" as const };
	}
}

/** 转化率 (两阶段计数比), 数据为 0 时返回 null 表示不展示. */
function conversionRate(numerator: number, denominator: number): number | null {
	if (!denominator)
		return null;
	return Math.round((numerator / denominator) * 100);
}

export default function LabelDashboard() {
	const token = useLlmTokens();
	const navigate = useNavigate();

	const overviewQuery = useQuery({ queryKey: ["ls-overview"], queryFn: fetchPlatformOverview, staleTime: 60_000 });
	const assetsQuery = useQuery({ queryKey: ["ls-assets"], queryFn: fetchAssets, staleTime: 60_000 });
	const qaQuery = useQuery({ queryKey: ["ls-qa-list", {}], queryFn: () => listQAItems({ page_size: 1 }), staleTime: 60_000 });
	const jobsQuery = useQuery({ queryKey: ["ls-jobs"], queryFn: fetchTrainingJobs, staleTime: 60_000 });
	const modelsQuery = useQuery({ queryKey: ["ls-models"], queryFn: fetchTrainedModels, staleTime: 60_000 });

	// ★ 用后端 total (而非 items.length), 数据量大也准确
	const assetsTotal = assetsQuery.data?.total ?? assetsQuery.data?.items.length ?? 0;
	const qaTotal = qaQuery.data?.total ?? qaQuery.data?.items.length ?? 0;
	const jobs = jobsQuery.data?.items ?? [];
	const models = modelsQuery.data?.items ?? [];
	const overview = overviewQuery.data;
	const jobsTotal = jobs.length;
	const modelsDeployed = models.filter(m => m.status === "deployed").length;

	const dashboardQueries = [overviewQuery, assetsQuery, qaQuery, jobsQuery, modelsQuery];
	const isDashboardLoading = dashboardQueries.some(query => query.isLoading);
	const failedDashboardQuery = dashboardQueries.find(query => query.isError);
	const isRefetching = dashboardQueries.some(q => q.isFetching) && !isDashboardLoading;
	const retryDashboardQueries = () => dashboardQueries.forEach(query => query.isError && query.refetch());

	const metrics = [
		{
			title: "数据资产",
			value: assetsTotal,
			icon: <FileTextOutlined />,
			color: token.colorPrimary,
			help: "全部上传的数据资产（文本/图片/视频，含各状态）",
			onClick: () => navigate("/label-system/data-management"),
		},
		{
			title: "标注项",
			value: qaTotal,
			icon: <ThunderboltOutlined />,
			color: token.colorSuccess,
			help: "全部资产的全部标注项（含待审核/已通过/已驳回等所有状态）",
			onClick: () => navigate("/label-system/data-annotation"),
		},
		{
			title: "训练任务",
			value: jobsTotal,
			icon: <RocketOutlined />,
			color: token.colorWarning,
			help: "全部训练任务（含示例/真实训练，各状态）",
			onClick: () => navigate("/label-system/training-pipeline"),
		},
		{
			title: "已部署模型",
			value: modelsDeployed,
			icon: <DeploymentUnitOutlined />,
			color: token.colorError,
			help: "当前已部署为推理服务的模型数量",
			onClick: () => navigate("/label-system/model-hub"),
		},
	];

	// ★ 真实转化率 (基于后端 total), 取代无语义的假百分比
	const funnel = [
		{ name: "数据接入", count: assetsTotal, color: token.colorPrimary, route: "/label-system/data-management" },
		{ name: "智能标注", count: qaTotal, color: token.colorSuccess, route: "/label-system/data-annotation" },
		{ name: "训练任务", count: jobsTotal, color: token.colorWarning, route: "/label-system/training-pipeline" },
		{ name: "模型部署", count: modelsDeployed, color: token.colorError, route: "/label-system/model-hub" },
	];
	const rateAssets2Qa = conversionRate(qaTotal, assetsTotal);
	const rateQa2Jobs = conversionRate(jobsTotal, qaTotal);

	const cardStyle: CSSProperties = { background: token.colorBgContainer, borderRadius: 12 };

	return (
		<Space orientation="vertical" size={16} className="w-full">
			<Card variant="borderless" style={{ background: token.colorPrimaryBg }}>
				<div className="flex items-center justify-between gap-3 flex-wrap">
					<div>
						<Title level={3} className="mb-1">
							<RadarChartOutlined />
							{" "}
							智能标注数据飞轮
						</Title>
						<Paragraph type="secondary" className="mb-0">
							从资料上传到模型部署的完整闭环。全格式智能解析 → 多模型置信度比对标注 → 训练管线 → 推理部署。
						</Paragraph>
					</div>
					<Tooltip title="刷新全部指标">
						<Button icon={<ReloadOutlined spin={isRefetching} />} onClick={() => dashboardQueries.forEach(q => q.refetch())} />
					</Tooltip>
				</div>
			</Card>

			<QueryState
				isLoading={isDashboardLoading}
				isError={!!failedDashboardQuery}
				error={failedDashboardQuery?.error}
				onRetry={retryDashboardQueries}
				skeletonRows={8}
			>
				<Space orientation="vertical" size={16} className="w-full">
					<Row gutter={[16, 16]}>
						{metrics.map(m => (
							<Col xs={12} lg={6} key={m.title}>
								<Card hoverable variant="borderless" style={cardStyle} onClick={m.onClick}>
									<Statistic
										title={<Tooltip title={m.help}><span>{m.title}</span></Tooltip>}
										value={m.value}
										prefix={<span style={{ color: m.color }}>{m.icon}</span>}
										styles={{ content: { color: m.color } }}
									/>
								</Card>
							</Col>
						))}
					</Row>

					<Row gutter={[16, 16]}>
						{/* 数据飞轮漏斗: 真实计数 + 阶段转化率 (取代无语义假百分比) */}
						<Col xs={24} lg={12}>
							<Card title="数据飞轮漏斗" variant="borderless" style={cardStyle}>
								<Space orientation="vertical" size={20} className="w-full">
									{funnel.map((s, idx) => {
										const prevCount = idx === 0 ? null : funnel[idx - 1].count;
										const rate = idx === 0 ? null : conversionRate(s.count, prevCount ?? 0);
										return (
											<div
												key={s.name}
												className="cursor-pointer"
												onClick={() => navigate(s.route)}
											>
												<Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 6 }}>
													<Space size={8}>
														<Tag color="blue">{s.name}</Tag>
														{idx > 0 && rate != null && (
															<Tooltip title={rate > 100 ? "后阶段计数超过前阶段 (如多问题抽取)，视为已充分覆盖" : undefined}>
																<Typography.Text type="secondary" className="text-xs">
																	{`转化率 ${rate > 100 ? 100 : rate}%${rate > 100 ? "+" : ""}`}
																</Typography.Text>
															</Tooltip>
														)}
													</Space>
													<Typography.Text strong style={{ color: s.color }}>
														{s.count}
														{" "}
														项
													</Typography.Text>
												</Space>
												{/* 仅展示相对宽度 (当前阶段/最大值), 不再是"进度"语义 */}
												<Progress
													percent={funnel.length ? Math.round((s.count / Math.max(...funnel.map(f => f.count), 1)) * 100) : 0}
													strokeColor={s.color}
													showInfo={false}
													size="small"
												/>
											</div>
										);
									})}
									{(rateAssets2Qa != null || rateQa2Jobs != null) && (
										<Typography.Text type="secondary" className="text-xs">
											💡 转化率 = 后一阶段计数 / 前一阶段计数，反映数据在各环节的留存/产出比。
										</Typography.Text>
									)}
								</Space>
							</Card>
						</Col>

						{/* 动态概览: 取代静态"平台能力"文案, 展示真实派生指标 */}
						<Col xs={24} lg={12}>
							<Card title="飞轮概览" variant="borderless" style={cardStyle}>
								<Space orientation="vertical" size={12} className="w-full">
									<div className="flex items-center justify-between">
										<Typography.Text type="secondary">标注覆盖率</Typography.Text>
										<Typography.Text strong>
											{rateAssets2Qa != null ? `${rateAssets2Qa}%` : "—"}
										</Typography.Text>
									</div>
									<div className="flex items-center justify-between">
										<Typography.Text type="secondary">QA → 训练转化</Typography.Text>
										<Typography.Text strong>
											{rateQa2Jobs != null ? `${rateQa2Jobs}%` : "—"}
										</Typography.Text>
									</div>
									<div className="flex items-center justify-between">
										<Typography.Text type="secondary">运行中任务</Typography.Text>
										<Space size={6}>
											{jobs.filter(j => j.status === "running").length > 0 && <LoadingOutlined style={{ color: token.colorInfo }} />}
											<Typography.Text strong>{jobs.filter(j => j.status === "running").length}</Typography.Text>
										</Space>
									</div>
									<div className="flex items-center justify-between">
										<Typography.Text type="secondary">失败任务</Typography.Text>
										<Typography.Text strong style={{ color: jobs.some(j => j.status === "failed") ? token.colorError : undefined }}>
											{jobs.filter(j => j.status === "failed").length}
										</Typography.Text>
									</div>
									<div className="flex items-center justify-between">
										<Typography.Text type="secondary">支持格式</Typography.Text>
										<Tooltip title={(overview?.supported_formats || overview?.supportedFormat || ["pdf", "docx", "xlsx", "csv", "html", "json", "png", "jpg", "mp4"]).join("、")}>
											<Space size={4}>
												<DatabaseOutlined />
												<Typography.Text strong>
													{(overview?.supported_formats || overview?.supportedFormat || ["pdf", "docx", "xlsx", "csv", "html", "json", "png", "jpg", "mp4"]).length}
													{" "}
													种
												</Typography.Text>
											</Space>
										</Tooltip>
									</div>
								</Space>
							</Card>
						</Col>
					</Row>

					<Card title="最近训练任务" variant="borderless" style={cardStyle}>
						{jobs.length > 0
							? (
								<Space orientation="vertical" size={8} className="w-full">
									{jobs.slice(0, 5).map((j: TrainingJob) => {
										const vis = jobStatusVisual(j.status, token);
										return (
											<Card key={j.id} size="small" variant="borderless" style={{ background: token.colorFillQuaternary }}>
												<Space style={{ width: "100%", justifyContent: "space-between" }}>
													<Space>
														<span style={{ color: vis.color }}>{vis.icon}</span>
														<Typography.Text strong>{j.base_model}</Typography.Text>
														<Tag color={vis.tagColor}>{j.status}</Tag>
													</Space>
													{j.progress != null && <Progress percent={j.progress} size="small" className="w-[120px]" />}
												</Space>
											</Card>
										);
									})}
								</Space>
							)
							: (
								<EmptyState description="暂无训练任务" />
							)}
					</Card>
				</Space>
			</QueryState>
		</Space>
	);
}
