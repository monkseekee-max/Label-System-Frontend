import { fetchAlerts, fetchSloSnapshot, type AlertItem } from "#src/api/llm-factory/admin";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Empty, Row, Segmented, Statistic } from "antd";
import { useState } from "react";

const WINDOWS = [
	{ label: "24h", value: "24" },
	{ label: "7天", value: "168" },
];

function pct(v: number): string {
	return `${(v * 100).toFixed(1)}%`;
}

export default function ObservabilityDashboard() {
	const token = useLlmTokens();
	const [window, setWindow] = useState("24");
	const w = Number(window);

	const { data, error, isError, isLoading, refetch } = useQuery({
		queryKey: ["admin", "slo", window],
		queryFn: () => fetchSloSnapshot(w).then(r => r.data),
		refetchInterval: 60_000,
	});
	const { data: alertsResp } = useQuery({
		queryKey: ["admin", "alerts", window],
		queryFn: () => fetchAlerts(w).then(r => r.data),
		refetchInterval: 60_000,
	});
	const alerts: AlertItem[] = alertsResp?.alerts ?? [];

	return (
		<div className="p-6">
			<div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<div>
					<h2 className="m-0 text-xl font-semibold">可观测性 · SLO</h2>
					<p style={{ margin: "4px 0 0 0", color: token.colorTextSecondary, fontSize: 14 }}>
						业务级 SLO 聚合 + 告警 (ADR-019 P4-2). 基础设施指标见 Prometheus.
					</p>
				</div>
				<Segmented options={WINDOWS} value={window} onChange={v => setWindow(String(v))} />
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="SLO 真实接口不可用" />}

			{alerts.length > 0 && (
				<div className="mb-4">
					{alerts.map((a, i) => (
						<Alert
							key={i}
							className="mb-2"
							type={a.level === "critical" ? "error" : "warning"}
							showIcon
							message={a.message}
							description={`类别: ${a.category} · 指标: ${a.metric} · 当前 ${a.value} · 阈值 ${a.threshold}`}
						/>
					))}
				</div>
			)}

			<Row gutter={16}>
				<Col span={12} className="mb-4">
					<Card title="训练 SLO" loading={isLoading}>
						<Row gutter={16}>
							<Col xs={24} sm={12} lg={8}><Statistic title="任务总数" value={data?.training.total ?? 0} /></Col>
							<Col xs={24} sm={12} lg={8}><Statistic title="成功率" value={data ? pct(data.training.successRate) : "—"} styles={{ content: { color: (data?.training.successRate ?? 1) >= 0.8 ? "#3f8600" : "#cf1322" } }} /></Col>
							<Col xs={24} sm={12} lg={8}><Statistic title="中位耗时(秒)" value={data?.training.medianDurationSec ?? "—"} /></Col>
						</Row>
						<pre style={{ marginTop: 12, fontSize: 11, color: token.colorTextSecondary, maxHeight: 120, overflow: "auto" }}>{JSON.stringify(data?.training.counts ?? {}, null, 2)}</pre>
					</Card>
				</Col>
				<Col span={12} className="mb-4">
					<Card title="模型 SLO" loading={isLoading}>
						<Row gutter={16}>
							<Col xs={24} sm={12} lg={6}><Statistic title="门禁尝试" value={data?.model.gateAttempts ?? 0} /></Col>
							<Col xs={24} sm={12} lg={6}><Statistic title="门禁通过" value={data?.model.gatePassed ?? 0} /></Col>
							<Col xs={24} sm={12} lg={6}><Statistic title="通过率" value={data ? pct(data.model.gatePassRate) : "—"} /></Col>
							<Col xs={24} sm={12} lg={6}><Statistic title="回滚次数" value={data?.model.rollbackCount ?? 0} styles={{ content: { color: (data?.model.rollbackCount ?? 0) > 0 ? "#cf1322" : undefined } }} /></Col>
						</Row>
					</Card>
				</Col>
				<Col span={12} className="mb-4">
					<Card title="标注漏斗" loading={isLoading}>
						{data && data.label.total > 0
							? <pre style={{ fontSize: 12, maxHeight: 140, overflow: "auto" }}>{JSON.stringify(data.label.counts, null, 2)}</pre>
							: <Empty description="暂无标注任务" />}
					</Card>
				</Col>
				<Col span={12} className="mb-4">
					<Card title="GPU / API">
						<Alert type="info" showIcon message={data?.gpu.reason ?? "—"} className="mb-2" />
						<Alert type="info" showIcon message={data?.api.reason ?? "—"} />
					</Card>
				</Col>
			</Row>
		</div>
	);
}
