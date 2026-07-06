/**
 * ADR-019 P3-5: 线上反馈回流 Panel
 *
 * 展示当前租户的反馈样本池 (low_confidence / user_correction / eval_failure)
 * + 一键生成标注任务 (回流入标注项目).
 *
 * 数据源: GET /api/v1/feedback/pending
 * 操作: POST /api/v1/feedback/generate-tasks
 */
import { generateFeedbackTasks, listPendingFeedback } from "#src/api/llm-factory";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Empty, Popconfirm, Table, Tag } from "antd";

const SOURCE_CONFIG: Record<string, { label: string, color: string }> = {
	low_confidence: { label: "低置信", color: "warning" },
	user_correction: { label: "用户纠错", color: "error" },
	eval_failure: { label: "评测失败", color: "volcano" },
};

function formatSource(source: string): { label: string, color: string } {
	return SOURCE_CONFIG[source] ?? { label: source, color: "default" };
}

function formatTime(iso: string | null): string {
	if (!iso)
		return "—";
	try {
		return new Date(iso).toLocaleString("zh-CN");
	}
	catch {
		return iso;
	}
}

interface FeedbackLoopPanelProps {
	companyId?: number
	projectId?: number
}

export function FeedbackLoopPanel({ companyId = 1, projectId = 1 }: FeedbackLoopPanelProps) {
	const token = useLlmTokens();
	const queryClient = useQueryClient();

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["llm-factory", "feedback", "pending", companyId],
		queryFn: () => listPendingFeedback(companyId),
		staleTime: 30_000,
	});

	async function handleGenerate() {
		try {
			const res = (await generateFeedbackTasks({ companyId, projectId, maxCount: 50 })) as { generated_count?: number };
			window.$message?.success(`已生成 ${res.generated_count ?? 0} 个标注任务`);
			queryClient.invalidateQueries({ queryKey: ["llm-factory", "feedback"] });
		}
		catch (e) {
			window.$message?.error(`生成任务失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	const samples = data ?? [];
	const pendingCount = samples.filter(s => s.status === "pending").length;

	return (
		<Card
			title={(
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span>线上反馈回流</span>
					<Badge count={pendingCount} overflowCount={999} style={{ backgroundColor: token.colorError }} />
				</div>
			)}
			extra={(
				<Popconfirm title={`生成标注任务到项目 ${projectId}？`} onConfirm={handleGenerate}>
					<Button size="small" type="primary" disabled={pendingCount === 0}>
						生成标注任务
					</Button>
				</Popconfirm>
			)}
		>
			{error && (
				<div style={{ color: token.colorError, fontSize: 12, marginBottom: 12 }}>
					反馈数据接口不可用:
					{" "}
					{error instanceof Error ? error.message : String(error)}
					<Button size="small" type="link" onClick={() => void refetch()}>重试</Button>
				</div>
			)}
			{!error && samples.length === 0 && !isLoading && <Empty description="暂无待标注反馈样本" />}
			{samples.length > 0 && (
				<Table<ReturnType<typeof Object> & { sample_id: string }>
					size="small"
					pagination={{ pageSize: 5, size: "small" }}
					loading={isLoading}
					dataSource={samples as any}
					rowKey="sample_id"
					columns={[
						{
							title: "来源",
							dataIndex: "source",
							width: 100,
							render: (v: string) => {
								const cfg = formatSource(v);
								return <Tag color={cfg.color}>{cfg.label}</Tag>;
							},
						},
						{
							title: "内容",
							dataIndex: "content",
							ellipsis: true,
							render: (v: string) => <span className="text-xs">{v}</span>,
						},
						{
							title: "触发模型",
							dataIndex: "model_tag",
							width: 160,
							render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: 11 }}>{v}</span>,
						},
						{
							title: "置信度",
							dataIndex: "confidence",
							width: 80,
							render: (v: number | null) => v === null ? "—" : <span className="font-mono">{v.toFixed(2)}</span>,
						},
						{
							title: "状态",
							dataIndex: "status",
							width: 80,
							render: (v: string) => <Tag color={v === "pending" ? "processing" : "default"}>{v}</Tag>,
						},
						{
							title: "时间",
							dataIndex: "created_at",
							width: 140,
							render: formatTime,
						},
					]}
				/>
			)}
		</Card>
	);
}
