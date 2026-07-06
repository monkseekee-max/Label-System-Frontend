import { cancelTrainingTask, fetchTrainingJobDetail } from "#src/api/llm-factory";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, TERMINAL_THEME, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Col, Descriptions, Popconfirm, Row, Steps, Tag } from "antd";
import ReactECharts from "echarts-for-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

const STATUS_COLORS: Record<string, string> = {
	RUNNING: "processing",
	COMPLETED: "success",
	FAILED: "error",
	OOM: "error",
	PENDING: "default",
};

const STATUS_LABELS: Record<string, string> = {
	RUNNING: "运行中",
	COMPLETED: "已完成",
	FAILED: "失败",
	OOM: "OOM",
	PENDING: "等待中",
};

const PIPELINE_STEPS = [
	{ title: "数据摄入", description: "2m" },
	{ title: "标注", description: "45m" },
	{ title: "质量过滤", description: "8m" },
	{ title: "SFT 训练", description: "ETA 2h" },
	{ title: "评测", description: "" },
	{ title: "部署", description: "" },
];

export default function TrainingDetail() {
	const token = useLlmTokens();
	const { id } = useParams<{ id: string }>();
	const queryClient = useQueryClient();
	const [terminating, setTerminating] = useState(false);

	const { data, isLoading, error, isError, refetch } = useQuery({
		queryKey: ["llm-factory", "training", "detail", id],
		queryFn: () => fetchTrainingJobDetail(id!).then(r => r.result),
		enabled: Boolean(id),
	});

	const handleTerminate = async () => {
		if (!id)
			return;
		setTerminating(true);
		try {
			await cancelTrainingTask(id);
			window.$message?.success("训练任务已终止");
			queryClient.invalidateQueries({ queryKey: ["llm-factory", "training"] });
		}
		catch (err) {
			window.$message?.error(`终止失败: ${err instanceof Error ? err.message : String(err)}`);
		}
		finally {
			setTerminating(false);
		}
	};

	const [logLines, setLogLines] = useState<string[]>([]);
	const logContainerRef = useRef<HTMLDivElement>(null);

	// Simulate live log streaming for demo purposes
	useEffect(() => {
		if (data && !logLines.length) {
			// Start log simulation after data loads
			const interval = setInterval(() => {
				const timestamp = new Date().toLocaleTimeString();
				const step = Math.floor(Math.random() * 3) + 4;
				const loss = (1.5 - Math.random() * 0.5).toFixed(2);
				const lr = (0.0002 - Math.random() * 0.00005).toExponential(2);
				const steps = Math.floor(Math.random() * 1000) + 2000;
				const total = 4096;

				setLogLines(prev => [
					...prev,
					`[${timestamp}] INFO: Step ${step}/7 - Training`,
					`[${timestamp}] INFO: Loss: ${loss}, LR: ${lr}, Steps: ${steps}/${total}`,
					`[${timestamp}] INFO: GPU Memory: 12.3GB / 24GB (51%)`,
					`[${timestamp}] INFO: Throughput: 1.2 samples/sec`,
				]);
			}, 2000);

			return () => clearInterval(interval);
		}
	}, [data, logLines.length]);

	// Auto-scroll to bottom when new logs arrive
	useEffect(() => {
		if (logContainerRef.current) {
			logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
		}
	}, [logLines]);

	if (isLoading) {
		return (
			<BasicContent>
				<div style={{ padding: 100, textAlign: "center" }}>加载中...</div>
			</BasicContent>
		);
	}

	if (isError) {
		return (
			<BasicContent>
				<QueryErrorAlert error={error} onRetry={() => void refetch()} title="训练任务详情真实接口不可用" />
			</BasicContent>
		);
	}

	if (!data) {
		return (
			<BasicContent>
				<div style={{ padding: 100, textAlign: "center" }}>训练任务不存在</div>
			</BasicContent>
		);
	}

	const getStepStatus = (index: number) => {
		const progress = data.pipelineProgress || 0;
		if (index < progress)
			return "finish";
		if (index === progress)
			return data.status === "RUNNING" ? "process" : "wait";
		return "wait";
	};

	const getStepIcon = (index: number) => {
		const status = getStepStatus(index);
		if (status === "finish")
			return <CheckCircleOutlined />;
		if (status === "process")
			return <ClockCircleOutlined />;
		if (status === "wait" && data.status === "FAILED")
			return <CloseCircleOutlined />;
		return undefined;
	};

	// Loss chart option
	const lossChartOption = {
		animation: false,
		grid: { top: 30, right: 30, bottom: 30, left: 60 },
		xAxis: {
			type: "category",
			data: ["0", "500", "1000", "1500", "2000", "2500", "3000"],
			axisLine: { lineStyle: { color: token.colorBorderSecondary } },
			axisLabel: { color: token.colorTextSecondary },
		},
		yAxis: {
			type: "value",
			name: "Loss",
			nameTextStyle: { color: token.colorTextSecondary },
			axisLine: { lineStyle: { color: token.colorBorderSecondary } },
			axisLabel: { color: token.colorTextSecondary },
			splitLine: { lineStyle: { color: token.colorFillQuaternary } },
		},
		series: [
			{
				name: "Train Loss",
				type: "line",
				data: [2.5, 1.8, 1.4, 1.2, 1.0, 0.85, 0.75],
				smooth: true,
				showSymbol: true,
				lineStyle: { color: CHART_COLORS.primary, width: 2 },
				itemStyle: { color: CHART_COLORS.primary },
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(24, 144, 255, 0.3)" },
							{ offset: 1, color: "rgba(24, 144, 255, 0.05)" },
						],
					},
				},
			},
			{
				name: "Eval Loss",
				type: "line",
				data: [2.3, 1.7, 1.5, 1.3, 1.15, 1.05, 0.98],
				smooth: true,
				showSymbol: true,
				lineStyle: { color: CHART_COLORS.success, width: 2 },
				itemStyle: { color: CHART_COLORS.success },
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(82, 196, 26, 0.3)" },
							{ offset: 1, color: "rgba(82, 196, 26, 0.05)" },
						],
					},
				},
			},
		],
		tooltip: {
			trigger: "axis",
			backgroundColor: token.colorBgContainer,
			borderColor: token.colorBorderSecondary,
			borderWidth: 1,
			textStyle: { color: token.colorText },
		},
		legend: {
			data: ["Train Loss", "Eval Loss"],
			top: 0,
			right: 30,
			textStyle: { color: token.colorTextSecondary },
		},
	};

	return (
		<BasicContent>
			{/* Detail Header */}
			<div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
				<div style={{ fontSize: 24, fontFamily: "monospace", fontWeight: 600 }}>{data.id}</div>
				<Tag color={STATUS_COLORS[data.status] ?? "default"}>{STATUS_LABELS[data.status] ?? data.status}</Tag>
				<Tag color="blue">
					{data.baseModel}
					{" "}
					· Unsloth SFT
				</Tag>
				{data.status === "RUNNING" && (
					<Popconfirm title="确认终止训练？" onConfirm={handleTerminate}>
						<button
							type="button"
							disabled={terminating}
							style={{
								padding: "4px 12px",
								border: "1px solid #ff4d4f",
								background: token.colorBgContainer,
								color: CHART_COLORS.error,
								borderRadius: 4,
								cursor: "pointer",
							}}
						>
							终止训练
						</button>
					</Popconfirm>
				)}
			</div>

			{/* Pipeline Progress */}
			<Card className="mb-4">
				<Steps
					current={data.pipelineProgress}
					items={PIPELINE_STEPS.map((step, index) => ({
						title: step.title,
						description: step.description,
						status: getStepStatus(index),
						icon: getStepIcon(index),
					}))}
				/>
			</Card>

			<Row gutter={16}>
				{/* Left Column */}
				<Col xs={24} lg={14}>
					{/* Loss Chart Card */}
					<Card className="mb-4">
						<div className="text-base font-semibold mb-4">训练曲线</div>
						<ReactECharts
							option={lossChartOption}
							style={{ height: 300 }}
							opts={{ renderer: "svg" }}
						/>
						<Row gutter={16} style={{ marginTop: 16 }}>
							<Col span={6}>
								<div className="text-center">
									<div style={{ fontSize: 24, fontWeight: 600, color: CHART_COLORS.primary }}>0.75</div>
									<div style={{ fontSize: 12, color: token.colorTextSecondary }}>Train Loss</div>
								</div>
							</Col>
							<Col span={6}>
								<div className="text-center">
									<div style={{ fontSize: 24, fontWeight: 600, color: CHART_COLORS.success }}>0.98</div>
									<div style={{ fontSize: 12, color: token.colorTextSecondary }}>Eval Loss</div>
								</div>
							</Col>
							<Col span={6}>
								<div className="text-center">
									<div style={{ fontSize: 24, fontWeight: 600, color: CHART_COLORS.purple }}>2e-4</div>
									<div style={{ fontSize: 12, color: token.colorTextSecondary }}>Learning Rate</div>
								</div>
							</Col>
							<Col span={6}>
								<div className="text-center">
									<div style={{ fontSize: 24, fontWeight: 600, color: token.colorWarning }}>3000</div>
									<div style={{ fontSize: 12, color: token.colorTextSecondary }}>Steps/4096</div>
								</div>
							</Col>
						</Row>
					</Card>

					{/* Training Config Card */}
					<Card>
						<div className="text-base font-semibold mb-4">训练配置</div>
						<Descriptions column={2} bordered size="small">
							<Descriptions.Item label="基座模型">{data.baseModel}</Descriptions.Item>
							<Descriptions.Item label="训练轨道">文本 Unsloth SFT</Descriptions.Item>
							<Descriptions.Item label="LoRA Rank">16</Descriptions.Item>
							<Descriptions.Item label="LoRA Alpha">32</Descriptions.Item>
							<Descriptions.Item label="Batch Size">4</Descriptions.Item>
							<Descriptions.Item label="梯度累积">4</Descriptions.Item>
							<Descriptions.Item label="Epochs">3</Descriptions.Item>
							<Descriptions.Item label="Max Seq Length">4096</Descriptions.Item>
							<Descriptions.Item label="数据集">SFT_Instruction_v3</Descriptions.Item>
							<Descriptions.Item label="GPU">RTX 5090 #0-1</Descriptions.Item>
						</Descriptions>
					</Card>
				</Col>

				{/* Right Column - Log Console */}
				<Col span={10}>
					<Card
						style={{
							height: "calc(100vh - 250px)",
							background: TERMINAL_THEME.bg,
							borderColor: TERMINAL_THEME.border,
							display: "flex",
							flexDirection: "column",
						}}
						styles={{ body: {
							flex: 1,
							display: "flex",
							flexDirection: "column",
							padding: 0,
						} }}
					>
						<div style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							padding: "12px 16px",
							borderBottom: "1px solid #1f2937",
							color: token.colorBgContainer,
							fontSize: 14,
							fontFamily: "monospace",
						}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<div style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS.success }} />
								<span>实时日志</span>
							</div>
							<span style={{ fontSize: 12, opacity: 0.7 }}>● Streaming</span>
						</div>
						<div
							ref={logContainerRef}
							style={{
								flex: 1,
								overflow: "auto",
								fontFamily: "monospace",
								fontSize: 12,
								lineHeight: 1.6,
								color: token.colorBgContainer,
								whiteSpace: "pre-wrap",
								padding: 12,
							}}
						>
							{logLines.length > 0
								? (
									logLines.map((line, i) => (
										<div key={i} className="mb-1">
											{line}
										</div>
									))
								)
								: (
									<div style={{ color: token.colorTextSecondary }}>等待日志输出...</div>
								)}
						</div>
					</Card>
				</Col>
			</Row>
		</BasicContent>
	);
}
