/**
 * ADR-019 P3-1/P3-4: 模型 lifecycle 操作日志 + 上下文回溯 Drawer
 *
 * - OperationLogDrawer: 调用 getModelLifecycle, 展示 operations 时间线
 * - ModelContextDrawer: 调用 getModelContext, 展示 lifecycle + lineage + eval + operations
 *
 * 设计: Drawer 由父组件受控 (open + versionTag), 内部 useQuery 自动获取数据.
 * 失败时显示 QueryErrorAlert, 不静默回退 (ADR-019 P0-1).
 */
import { getModelContext, getModelLifecycle } from "#src/api/llm-factory";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, Drawer, Empty, Spin, Table, Tag, Timeline, Typography } from "antd";

import { lifecycleStateColor, lifecycleStateLabel } from "./lifecycle-ui";

const { Text } = Typography;

const ACTION_LABELS: Record<string, string> = {
	register: "注册",
	promote_to_prod: "晋升生产",
	archive: "归档",
	discard: "废弃",
	reject: "拒绝",
	supersede: "取代",
};

function formatAction(action: string): string {
	return ACTION_LABELS[action] ?? action;
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

interface DrawerState {
	open: boolean
	versionTag: string | null
}

interface OperationLogDrawerProps {
	state: DrawerState
	onClose: () => void
}

export function OperationLogDrawer({ state, onClose }: OperationLogDrawerProps) {
	const token = useLlmTokens();
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["llm-factory", "lifecycle", state.versionTag],
		queryFn: () => getModelLifecycle(state.versionTag!),
		enabled: Boolean(state.versionTag) && state.open,
		retry: false,
	});

	return (
		<Drawer
			title={(
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span>操作日志</span>
					{data && (
						<Tag color={lifecycleStateColor(data.state)}>
							{lifecycleStateLabel(data.state)}
						</Tag>
					)}
				</div>
			)}
			open={state.open}
			onClose={onClose}
			width={680}
			destroyOnClose
		>
			{isLoading && <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>}
			{error && (
				<QueryErrorAlert
					error={error}
					onRetry={() => void refetch()}
					title={`模型 ${state.versionTag} 未注册或后端不可用`}
				/>
			)}
			{data && data.operations.length === 0 && (
				<Empty description="暂无操作记录" />
			)}
			{data && data.operations.length > 0 && (
				<Timeline
					items={data.operations.map(op => ({
						color: op.action === "promote_to_prod" ? "green" : "blue",
						children: (
							<div>
								<div style={{ fontWeight: 600, marginBottom: 4 }}>
									{formatAction(op.action)}
									{op.fromState && op.toState && (
										<span style={{ marginLeft: 8, color: token.colorTextTertiary }}>
											{lifecycleStateLabel(op.fromState)}
											{" "}
											→
											{lifecycleStateLabel(op.toState)}
										</span>
									)}
								</div>
								<div style={{ fontSize: 12, color: token.colorTextSecondary }}>
									{op.actor && (
										<span>
											操作人:
											{op.actor}
										</span>
									)}
									{op.actor && op.createdAt && <span> · </span>}
									{op.createdAt && <span>{formatTime(op.createdAt)}</span>}
								</div>
								{op.reason && (
									<div style={{ fontSize: 12, marginTop: 4, color: token.colorTextSecondary }}>
										原因:
										{" "}
										{op.reason}
									</div>
								)}
								{op.gateDecision && (
									<div className="mt-1">
										<Tag color={op.gateDecision === "pass" ? "success" : "error"}>
											门禁:
											{" "}
											{op.gateDecision}
										</Tag>
									</div>
								)}
							</div>
						),
					}))}
				/>
			)}
		</Drawer>
	);
}

interface ModelContextDrawerProps {
	state: DrawerState
	onClose: () => void
}

export function ModelContextDrawer({ state, onClose }: ModelContextDrawerProps) {
	const token = useLlmTokens();
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["llm-factory", "model-context", state.versionTag],
		queryFn: () => getModelContext(state.versionTag!),
		enabled: Boolean(state.versionTag) && state.open,
		retry: false,
	});

	return (
		<Drawer
			title={`模型上下文 · ${state.versionTag ?? ""}`}
			open={state.open}
			onClose={onClose}
			width={820}
			destroyOnClose
		>
			{isLoading && <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>}
			{error && (
				<QueryErrorAlert
					error={error}
					onRetry={() => void refetch()}
					title={`模型 ${state.versionTag} 上下文不可用`}
				/>
			)}
			{data && (
				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					<Card size="small" title="Lifecycle 状态">
						<Descriptions column={3} size="small">
							<Descriptions.Item label="版本标签">{data.modelTag}</Descriptions.Item>
							<Descriptions.Item label="状态">
								<Tag color={lifecycleStateColor(data.lifecycle.state)}>
									{lifecycleStateLabel(data.lifecycle.state)}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label="模型族">{data.lifecycle.modelFamily}</Descriptions.Item>
							<Descriptions.Item label="租户">
								company_
								{data.lifecycle.companyId}
							</Descriptions.Item>
						</Descriptions>
					</Card>

					{data.lineage && (
						<Card size="small" title="训练数据血统 (Lineage)">
							<Descriptions column={2} size="small">
								<Descriptions.Item label="训练 Run">{data.lineage.training_run_id}</Descriptions.Item>
								<Descriptions.Item label="数据集版本">{data.lineage.dataset_version_tag}</Descriptions.Item>
								<Descriptions.Item label="数据指纹" span={2}>
									<Text code className="text-[11px]">{data.lineage.dataset_fingerprint}</Text>
								</Descriptions.Item>
								<Descriptions.Item label="标注数">{data.lineage.annotation_count}</Descriptions.Item>
								<Descriptions.Item label="Storage Key">
									<Text code className="text-[11px]">{data.lineage.storage_key ?? "—"}</Text>
								</Descriptions.Item>
							</Descriptions>
						</Card>
					)}

					{data.eval && (
						<Card size="small" title="评测结果 (P3-2 Gate)">
							<Descriptions column={2} size="small">
								<Descriptions.Item label="门禁决策">
									<Tag color={data.eval.gate_decision === "pass" ? "success" : "error"}>
										{data.eval.gate_decision ?? "—"}
									</Tag>
								</Descriptions.Item>
								<Descriptions.Item label="评测时间">{formatTime(data.eval.evaluated_at)}</Descriptions.Item>
								{data.eval.gate_reason && (
									<Descriptions.Item label="门禁原因" span={2}>{data.eval.gate_reason}</Descriptions.Item>
								)}
								<Descriptions.Item label="Storage Key" span={2}>
									<Text code className="text-[11px]">{data.eval.storage_key ?? "—"}</Text>
								</Descriptions.Item>
							</Descriptions>
							{Object.keys(data.eval.scores).length > 0 && (
								<div className="mt-3">
									<Text style={{ fontSize: 12, color: token.colorTextTertiary }}>指标分数:</Text>
									<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
										{Object.entries(data.eval.scores).map(([k, v]) => (
											<Tag key={k} color="blue">
												{k}
												:
												{typeof v === "number" ? v.toFixed(4) : String(v)}
											</Tag>
										))}
									</div>
								</div>
							)}
						</Card>
					)}

					<Card size="small" title="上线记录 (Operations)">
						{data.operations.length === 0
							? <Empty description="暂无操作记录" />
							: (
								<Table
									size="small"
									pagination={false}
									dataSource={data.operations.map((op, idx) => ({ ...op, key: idx }))}
									columns={[
										{ title: "操作", dataIndex: "action", render: formatAction, width: 100 },
										{
											title: "状态转换",
											render: (_, op) => (
												<span className="text-xs">
													{lifecycleStateLabel(op.fromState)}
													{" "}
													→
													{lifecycleStateLabel(op.toState)}
												</span>
											),
											width: 160,
										},
										{ title: "操作人", dataIndex: "actor", width: 100, render: v => v ?? "—" },
										{ title: "原因", dataIndex: "reason", render: v => v ?? "—" },
										{ title: "时间", dataIndex: "createdAt", render: formatTime, width: 160 },
									]}
								/>
							)}
					</Card>
				</div>
			)}
		</Drawer>
	);
}
