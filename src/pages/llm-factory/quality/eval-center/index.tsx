import type { Benchmark, BenchmarkSample } from "#src/api/llm-factory";
import {
	createBenchmark,
	fetchBenchmarkDetail,
	fetchBenchmarkList,
	fetchEvalJobList,
	runEvaluation,
} from "#src/api/llm-factory";
import { factoryApi } from "#src/api/llm-factory/factory-client";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { ModelContextDrawer } from "#src/pages/llm-factory/model/models/lifecycle-drawers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Alert,
	Button,
	Card,
	Col,
	Descriptions,
	Drawer,
	Empty,
	Form,
	Input,
	message,
	Modal,
	Row,
	Select,
	Space,
	Spin,
	Table,
	Tag,
	Tooltip,
	Typography,
} from "antd";
import { useMemo, useState } from "react";

import { FeedbackLoopPanel } from "./feedback-loop-panel";

const TASK_CATEGORY_LABEL: Record<string, string> = {
	TEXT_QA: "文本问答",
	IMAGE_CAPTION: "图片描述",
	IMAGE_QA: "图片问答",
	VIDEO_QA: "视频问答",
	VIDEO_CAPTION: "视频描述",
};

interface LoraVersionOption {
	label: string
	value: string
	baseModel: string
}

// 把 scores (嵌套 dict) 扁平化为可读指标列表
function flattenScores(scores: Record<string, unknown>): Array<{ label: string, value: number | null }> {
	const out: Array<{ label: string, value: number | null }> = [];
	for (const [group, val] of Object.entries(scores || {})) {
		if (val == null)
			continue;
		if (typeof val === "number") {
			out.push({ label: group, value: Math.round(val * 10000) / 100 });
			continue;
		}
		if (typeof val === "object") {
			for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
				if (typeof v === "number")
					out.push({ label: `${group}.${k}`, value: Math.round(v * 10000) / 100 });
			}
		}
	}
	return out;
}

function ScoreChips({ scores }: { scores: Record<string, unknown> }) {
	const token = useLlmTokens();
	const items = flattenScores(scores);
	if (items.length === 0)
		return <span style={{ color: token.colorTextTertiary }}>—</span>;
	return (
		<Space size={4} wrap>
			{items.map(it => (
				<Tooltip key={it.label} title={it.label}>
					<Tag style={{ marginInlineEnd: 0, fontFamily: "monospace", fontSize: 12 }}>
						<span style={{ color: token.colorTextTertiary }}>{it.label.split(".").pop()}</span>
						{": "}
						<span style={{ color: it.value != null && it.value >= 60 ? CHART_COLORS.success : it.value != null && it.value < 40 ? CHART_COLORS.error : CHART_COLORS.primary, fontWeight: 600 }}>
							{it.value ?? "—"}
						</span>
					</Tag>
				</Tooltip>
			))}
		</Space>
	);
}

export default function EvalCenter() {
	const token = useLlmTokens();
	const queryClient = useQueryClient();
	const [messageApi, contextHolder] = message.useMessage();

	const [ctxDrawer, setCtxDrawer] = useState<{ open: boolean, versionTag: string | null }>({ open: false, versionTag: null });
	const [detailDrawer, setDetailDrawer] = useState<{ open: boolean, benchmarkId: string | null }>({ open: false, benchmarkId: null });
	const [createOpen, setCreateOpen] = useState(false);
	const [runForm] = Form.useForm();
	const [createForm] = Form.useForm();

	// —— 数据查询 ——
	const { data: evalResult, error: evalError, isError: isEvalError, refetch: refetchEval } = useQuery({
		queryKey: ["llm-factory", "eval-jobs"],
		queryFn: () => fetchEvalJobList().then(r => r.result),
		refetchInterval: 8000,
	});

	const { data: benchmarks, error: benchmarkError, isError: isBenchmarkError, refetch: refetchBenchmarks } = useQuery({
		queryKey: ["llm-factory", "benchmarks"],
		queryFn: () => fetchBenchmarkList().then(r => r.result),
	});

	const { data: loraData } = useQuery({
		queryKey: ["llm-factory", "lora-versions"],
		queryFn: () => factoryApi.getLoraVersions(),
	});

	// 扁平化 lora 版本选项 (从 models[].loraVersions[] 展开)
	const loraOptions: LoraVersionOption[] = useMemo(() => {
		const models = loraData?.models || [];
		const opts: LoraVersionOption[] = [];
		for (const m of models) {
			for (const v of m.loraVersions || []) {
				opts.push({ label: v.versionTag, value: v.versionTag, baseModel: m.modelName });
			}
		}
		return opts;
	}, [loraData]);

	const benchmarkOptions = useMemo(() => (benchmarks || []).map(b => ({
		label: `${b.name}${b.benchmarkId ? ` (${b.benchmarkId})` : ""} · ${b.sampleCount} 样本`,
		value: b.benchmarkId || b.name,
	})), [benchmarks]);

	// 基准集详情 (Drawer)
	const { data: benchmarkDetail, isLoading: detailLoading } = useQuery({
		queryKey: ["llm-factory", "benchmark-detail", detailDrawer.benchmarkId],
		queryFn: () => fetchBenchmarkDetail(detailDrawer.benchmarkId!),
		enabled: !!detailDrawer.open && !!detailDrawer.benchmarkId,
	});

	// —— 变更操作 ——
	const runMutation = useMutation({
		mutationFn: runEvaluation,
		onSuccess: (res) => {
			messageApi.success(`评测已触发: ${res.jobId} (状态: ${res.status})`);
			queryClient.invalidateQueries({ queryKey: ["llm-factory", "eval-jobs"] });
		},
		onError: e => messageApi.error(`触发评测失败: ${e instanceof Error ? e.message : String(e)}`),
	});

	const createMutation = useMutation({
		mutationFn: createBenchmark,
		onSuccess: (res) => {
			messageApi.success(`基准集已创建: ${res.name} (${res.benchmarkId}, ${res.sampleCount} 样本)`);
			setCreateOpen(false);
			createForm.resetFields();
			queryClient.invalidateQueries({ queryKey: ["llm-factory", "benchmarks"] });
		},
		onError: e => messageApi.error(`创建基准集失败: ${e instanceof Error ? e.message : String(e)}`),
	});

	function handleRunEval() {
		runForm.validateFields().then((vals) => {
			runMutation.mutate({
				loraVersion: vals.loraVersion,
				benchmarkId: vals.benchmarkId,
				compareWith: vals.compareWith && vals.compareWith !== "none" ? vals.compareWith : undefined,
				runRegression: vals.runRegression === "enable",
			});
		}).catch(() => { /* 校验提示 */ });
	}

	function handleCreateBenchmark() {
		createForm.validateFields().then((vals) => {
			let samples: BenchmarkSample[] = [];
			if (vals.samplesText?.trim()) {
				try {
					samples = vals.samplesText
						.trim()
						.split("\n")
						.filter((l: string) => l.trim())
						.map((l: string) => JSON.parse(l));
				}
				catch {
					messageApi.error("样本 JSONL 格式错误: 每行必须是一个合法 JSON 对象");
					return;
				}
			}
			createMutation.mutate({
				name: vals.name,
				description: vals.description,
				benchmarkId: vals.benchmarkId || undefined,
				samples,
			});
		}).catch(() => { /* 校验提示 */ });
	}

	// —— 评测结果行 (直接用原始 records, 保留完整字段) ——
	const evalRows = evalResult?.records ?? [];
	const hasRunning = evalRows.some(r => (r as { status?: string }).status && (r as { status?: string }).status !== "completed");

	// 评测结果表列定义
	const evalColumns = [
		{
			title: "Job ID",
			dataIndex: "jobId",
			width: 180,
			render: (v: string) => <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text>,
		},
		{
			title: "LoRA 版本",
			dataIndex: "loraVersion",
			width: 170,
			render: (v: string, row: Record<string, unknown>) => (
				<Space direction="vertical" size={0}>
					<span style={{ fontFamily: "monospace", color: CHART_COLORS.primary, fontSize: 12 }}>{v}</span>
					{(row as { status?: string }).status && (row as { status?: string }).status !== "completed" && (
						<Tag color="processing" style={{ fontSize: 11 }}>{(row as { status?: string }).status}</Tag>
					)}
				</Space>
			),
		},
		{
			title: "模型",
			dataIndex: "modelName",
			width: 150,
			ellipsis: true,
			render: (v: string) => <span style={{ fontSize: 12 }}>{v || "—"}</span>,
		},
		{
			title: "基准集",
			dataIndex: "benchmarkId",
			width: 140,
			render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v || "—"}</span>,
		},
		{
			title: "指标分数 (%)",
			dataIndex: "scores",
			render: (v: Record<string, unknown>) => <ScoreChips scores={v} />,
		},
		{
			title: "门禁",
			dataIndex: "gateDecision",
			width: 110,
			render: (v: string, row: Record<string, unknown>) => {
				const gate = String(v || "PENDING").toUpperCase();
				const reason = (row as { gateReason?: string | null }).gateReason;
				return (
					<Tooltip title={reason ? `原因: ${reason} · 点击查看版本上下文` : "点击查看版本上下文"}>
						<button
							type="button"
							onClick={() => setCtxDrawer({ open: true, versionTag: (row as { loraVersion?: string }).loraVersion || null })}
							style={{
								padding: "2px 10px",
								borderRadius: 999,
								fontSize: 11,
								fontWeight: 600,
								cursor: "pointer",
								border: `1px solid ${gate === "PASS" ? CHART_COLORS.success : gate === "FAIL" ? CHART_COLORS.error : CHART_COLORS.warning}`,
								background: gate === "PASS" ? "rgba(82,196,26,0.1)" : gate === "FAIL" ? "rgba(255,77,79,0.1)" : "rgba(250,173,20,0.1)",
								color: gate === "PASS" ? CHART_COLORS.success : gate === "FAIL" ? CHART_COLORS.error : CHART_COLORS.warning,
							}}
						>
							{gate}
							↗
						</button>
					</Tooltip>
				);
			},
		},
		{
			title: "耗时",
			dataIndex: "durationSeconds",
			width: 90,
			render: (v: number | null) => v != null
				? (
					<span style={{ fontFamily: "monospace", fontSize: 12 }}>
						{(v / 60).toFixed(1)}
						m
					</span>
				)
				: "—",
		},
		{
			title: "完成时间",
			dataIndex: "completedAt",
			width: 160,
			render: (v: string) => v ? <span style={{ fontSize: 12 }}>{new Date(v).toLocaleString("zh-CN")}</span> : "—",
		},
	];

	// 基准集详情样本列
	const sampleColumns = [
		{ title: "#", width: 50, render: (_v: unknown, _r: unknown, i: number) => i + 1 },
		{
			title: "ID / 类型",
			width: 140,
			render: (_v: unknown, r: BenchmarkSample) => (
				<Space direction="vertical" size={0}>
					<Typography.Text code style={{ fontSize: 11 }}>{r.id || "—"}</Typography.Text>
					{r.type && <Tag style={{ fontSize: 11 }}>{r.type}</Tag>}
				</Space>
			),
		},
		{
			title: "输入",
			render: (_v: unknown, r: BenchmarkSample) => (
				<div style={{ fontSize: 12, color: token.colorTextSecondary }}>
					{r.input
						? Object.entries(r.input).map(([k, v]) => (
							<div key={k}>
								<span style={{ color: token.colorTextTertiary }}>
									{k}
									:
									{" "}
								</span>
								{String(v).slice(0, 120)}
							</div>
						))
						: JSON.stringify(r).slice(0, 120)}
				</div>
			),
		},
		{
			title: "期望输出",
			width: 240,
			render: (_v: unknown, r: BenchmarkSample) => (
				<div style={{ fontSize: 12 }}>
					{r.expected
						? Object.entries(r.expected).map(([k, v]) => (
							<div key={k}>
								<span style={{ color: token.colorTextTertiary }}>
									{k}
									:
									{" "}
								</span>
								<span style={{ color: CHART_COLORS.success }}>{String(v).slice(0, 100)}</span>
							</div>
						))
						: "—"}
				</div>
			),
		},
	];

	return (
		<BasicContent>
			{contextHolder}
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">评测中心</h2>
				<p className="mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
					异步评测 + 质量门禁 + 基准集管理。按任务类型路由评测指标。
					{hasRunning && <Tag color="processing" style={{ marginInlineStart: 8 }}>有运行中任务, 每 8s 自动刷新</Tag>}
				</p>
			</div>

			{isEvalError && <QueryErrorAlert error={evalError} onRetry={() => void refetchEval()} title="评测结果接口不可用" />}
			{isBenchmarkError && <QueryErrorAlert error={benchmarkError} onRetry={() => void refetchBenchmarks()} title="基准集接口不可用" />}

			{/* 触发评测 */}
			<Card className="mb-4" title={<span className="font-semibold">触发评测</span>}>
				<Form form={runForm} layout="vertical">
					<Row gutter={16}>
						<Col xs={24} sm={12} md={6}>
							<Form.Item label="LoRA 版本" name="loraVersion" rules={[{ required: true, message: "请选择 LoRA 版本" }]}>
								<Select
									showSearch
									placeholder="选择 LoRA 版本"
									options={loraOptions.length
										? loraOptions
										: [
											{ label: "lora_v20260614_005", value: "lora_v20260614_005" },
											{ label: "lora_v20260610_001", value: "lora_v20260610_001" },
										] as LoraVersionOption[]}
									notFoundContent="暂无版本, 可手动输入"
								/>
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={6}>
							<Form.Item label="基准集" name="benchmarkId" rules={[{ required: true, message: "请选择基准集" }]}>
								<Select showSearch placeholder="选择基准集" options={benchmarkOptions} />
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={6}>
							<Form.Item label="对比版本" name="compareWith" initialValue="none">
								<Select options={[{ label: "无", value: "none" }, ...loraOptions.map(o => ({ label: o.label, value: o.value }))]} />
							</Form.Item>
						</Col>
						<Col xs={24} sm={12} md={6}>
							<Form.Item label="回归测试" name="runRegression" initialValue="disable">
								<Select options={[{ label: "禁用", value: "disable" }, { label: "启用", value: "enable" }]} />
							</Form.Item>
						</Col>
					</Row>
					<div className="flex justify-end">
						<Button type="primary" loading={runMutation.isPending} onClick={handleRunEval}>开始评测</Button>
					</div>
				</Form>
			</Card>

			{/* 最新评测结果 */}
			<Card
				className="mb-4"
				title={<span className="font-semibold">最新评测结果</span>}
				extra={<Button size="small" onClick={() => refetchEval()}>刷新</Button>}
			>
				<Table
					size="small"
					rowKey="jobId"
					dataSource={evalRows as unknown as Record<string, unknown>[]}
					columns={evalColumns}
					pagination={{ pageSize: 8, size: "small", showSizeChanger: false }}
					loading={evalResult === undefined && !isEvalError}
					scroll={{ x: 1100 }}
					locale={{ emptyText: <Empty description="暂无评测结果, 触发一次评测试试" /> }}
				/>
			</Card>

			{/* 基准集管理 */}
			<Card
				className="mb-4"
				title={<span className="font-semibold">基准集</span>}
				extra={<Button type="primary" onClick={() => setCreateOpen(true)}>+ 创建新基准集</Button>}
			>
				{!benchmarks || benchmarks.length === 0
					? <Empty description="暂无基准集, 点击右上角创建" />
					: (
						<Row gutter={[16, 16]}>
							{benchmarks.map((benchmark: Benchmark & { benchmarkId?: string }) => (
								<Col xs={24} sm={12} md={8} lg={6} key={benchmark.benchmarkId || benchmark.id}>
									<Card
										hoverable
										size="small"
										onClick={() => setDetailDrawer({ open: true, benchmarkId: benchmark.benchmarkId || benchmark.name })}
										style={{ borderRadius: 12, border: `1px solid ${token.colorBorder}` }}
									>
										<div className="flex items-center justify-between mb-2">
											<span className="text-sm font-semibold">{benchmark.name}</span>
											{benchmark.taskCategory && <Tag color="blue" style={{ fontSize: 11 }}>{TASK_CATEGORY_LABEL[benchmark.taskCategory] || benchmark.taskCategory}</Tag>}
										</div>
										<div className="text-xs" style={{ color: token.colorTextTertiary }}>
											<div>
												{benchmark.sampleCount}
												{" "}
												样本 · 创建
												{" "}
												{benchmark.createdAt ? new Date(benchmark.createdAt).toLocaleDateString("zh-CN") : "—"}
											</div>
											{benchmark.benchmarkId && (
												<div className="mt-1 font-mono" style={{ fontSize: 11 }}>
													ID:
													{" "}
													{benchmark.benchmarkId}
												</div>
											)}
										</div>
									</Card>
								</Col>
							))}
						</Row>
					)}
			</Card>

			{/* P3-5 线上反馈回流 */}
			<div className="mb-4">
				<FeedbackLoopPanel companyId={1} projectId={1} />
			</div>

			{/* 创建基准集 Modal */}
			<Modal
				title="创建新基准集"
				open={createOpen}
				onCancel={() => setCreateOpen(false)}
				onOk={handleCreateBenchmark}
				confirmLoading={createMutation.isPending}
				okText="创建"
				cancelText="取消"
				width={680}
				destroyOnClose
			>
				<Form form={createForm} layout="vertical" preserve={false}>
					<Row gutter={16}>
						<Col span={14}>
							<Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入基准集名称" }]}>
								<Input placeholder="例: 桥梁检测-专业问答基准集" />
							</Form.Item>
						</Col>
						<Col span={10}>
							<Form.Item label="基准集 ID (可选, 留空自动生成)" name="benchmarkId">
								<Input placeholder="例: benchmark_bridge_v1" style={{ fontFamily: "monospace" }} />
							</Form.Item>
						</Col>
					</Row>
					<Form.Item label="描述" name="description">
						<Input.TextArea rows={2} placeholder="基准集用途、来源、覆盖场景等说明" />
					</Form.Item>
					<Form.Item
						label="评测样本 (JSONL 格式, 每行一个 JSON 对象)"
						name="samplesText"
						extra={(
							<span style={{ fontSize: 12, color: token.colorTextTertiary }}>
								结构示例:
								{" "}
								<code>{"{\"id\":\"q1\",\"type\":\"qa_answer\",\"input\":{\"document\":\"...\",\"question\":\"...\"},\"expected\":{\"answer\":\"...\"}}"}</code>
								。可留空先创建空基准集, 后续通过其他方式补充样本。
							</span>
						)}
					>
						<Input.TextArea
							rows={8}
							placeholder={"{\"id\":\"q1\",\"type\":\"qa_answer\",\"input\":{\"document\":\"...\",\"question\":\"...\"},\"expected\":{\"answer\":\"...\"}}\n{\"id\":\"q2\",...}"}
							style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12 }}
						/>
					</Form.Item>
				</Form>
			</Modal>

			{/* 基准集详情 Drawer */}
			<Drawer
				title={benchmarkDetail ? `基准集: ${benchmarkDetail.name}` : "基准集详情"}
				open={detailDrawer.open}
				onClose={() => setDetailDrawer({ open: false, benchmarkId: null })}
				width={760}
				destroyOnClose
			>
				{detailLoading
					? (
						<div className="flex justify-center" style={{ padding: 48 }}>
							<Spin />
						</div>
					)
					: benchmarkDetail
						? (
							<>
								<Descriptions size="small" column={1} bordered className="mb-4">
									<Descriptions.Item label="ID">{benchmarkDetail.benchmarkId}</Descriptions.Item>
									<Descriptions.Item label="名称">{benchmarkDetail.name}</Descriptions.Item>
									<Descriptions.Item label="描述">{benchmarkDetail.description || "—"}</Descriptions.Item>
									<Descriptions.Item label="样本数">{benchmarkDetail.sampleCount}</Descriptions.Item>
									<Descriptions.Item label="任务类型">{TASK_CATEGORY_LABEL[benchmarkDetail.taskCategory] || benchmarkDetail.taskCategory}</Descriptions.Item>
									<Descriptions.Item label="文件路径">
										<code style={{ fontSize: 12 }}>{benchmarkDetail.filePath}</code>
									</Descriptions.Item>
									<Descriptions.Item label="锁定状态">{benchmarkDetail.isLocked ? <Tag color="warning">已锁定</Tag> : <Tag color="success">可编辑</Tag>}</Descriptions.Item>
									<Descriptions.Item label="创建时间">{benchmarkDetail.createdAt ? new Date(benchmarkDetail.createdAt).toLocaleString("zh-CN") : "—"}</Descriptions.Item>
								</Descriptions>
								<div className="mb-2 flex items-center justify-between">
									<span className="font-semibold">
										评测样本 (
										{benchmarkDetail.samples.length}
										)
									</span>
								</div>
								{benchmarkDetail.samples.length === 0
									? <Empty description="该基准集暂无样本" />
									: (
										<Table<BenchmarkSample>
											size="small"
											rowKey={(_r, i) => String(i)}
											dataSource={benchmarkDetail.samples}
											columns={sampleColumns}
											pagination={{ pageSize: 10, size: "small" }}
										/>
									)}
							</>
						)
						: <Alert type="info" message="请选择一个基准集查看详情" showIcon />}
			</Drawer>

			{/* 版本上下文 Drawer (复用模型生命周期组件) */}
			<ModelContextDrawer
				state={ctxDrawer}
				onClose={() => setCtxDrawer({ open: false, versionTag: null })}
			/>
		</BasicContent>
	);
}
