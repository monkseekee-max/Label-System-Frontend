import {
	fetchAuditLogs,
	type AuditLogItem,
} from "#src/api/llm-factory/admin";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useQuery } from "@tanstack/react-query";
import { Card, Input, Space, Table, Tag } from "antd";
import { useState } from "react";

const ACTION_COLORS: Record<string, string> = {
	"user.login": "blue",
	"data.export": "cyan",
	"model.promote": "green",
	"model.rollback": "orange",
};

function formatJson(v: unknown): string {
	if (v == null)
		return "—";
	try {
		return JSON.stringify(v);
	}
	catch {
		return String(v);
	}
}

export default function AuditLogs() {
	const token = useLlmTokens();
	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [actor, setActor] = useState("");
	const [action, setAction] = useState("");

	const params = { pageNo, pageSize, actor: actor || undefined, action: action || undefined };
	const { data, error, isError, isLoading, refetch } = useQuery({
		queryKey: ["admin", "audit", params],
		queryFn: () => fetchAuditLogs(params).then(r => r.data),
	});

	const columns = [
		{ title: "时间", dataIndex: "createdAt", width: 180, render: (v: string) => v ?? "—" },
		{ title: "操作者", dataIndex: "actor", width: 120 },
		{
			title: "类型",
			dataIndex: "actorType",
			width: 90,
			render: (v: string) => <Tag color={v === "machine" ? "purple" : "default"}>{v}</Tag>,
		},
		{
			title: "动作",
			dataIndex: "action",
			width: 140,
			render: (v: string) => <Tag color={ACTION_COLORS[v] ?? "default"}>{v}</Tag>,
		},
		{ title: "资源类型", dataIndex: "resourceType", width: 110 },
		{ title: "资源ID", dataIndex: "resourceId", width: 140, render: (v: string | null) => v ?? "—" },
		{ title: "变更后", dataIndex: "after", render: (v: unknown) => <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{formatJson(v)}</span> },
		{ title: "IP", dataIndex: "ip", width: 130, render: (v: string | null) => v ?? "—" },
	];

	return (
		<div className="p-6">
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">审计日志</h2>
				<p style={{ margin: "4px 0 0 0", color: token.colorTextSecondary, fontSize: 14 }}>
					关键操作 (登录/导出/模型上线/回滚) 的不可变审计轨迹 (ADR-019 P4-3)
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="审计日志真实接口不可用" />}

			<Card>
				<Space className="mb-4" wrap>
					<Input.Search
						allowClear
						placeholder="按操作者过滤"
						className="w-[200px]"
						onSearch={(v) => { setActor(v); setPageNo(1); }}
					/>
					<Input.Search
						allowClear
						placeholder="按动作过滤 (如 model.promote)"
						style={{ width: 240 }}
						onSearch={(v) => { setAction(v); setPageNo(1); }}
					/>
				</Space>
				<Table<AuditLogItem>
					rowKey="id"
					loading={isLoading}
					dataSource={data?.records ?? []}
					columns={columns}
					pagination={{
						current: pageNo,
						pageSize,
						total: data?.total ?? 0,
						showSizeChanger: true,
						onChange: (p, s) => { setPageNo(p); setPageSize(s); },
					}}
				/>
			</Card>
		</div>
	);
}
