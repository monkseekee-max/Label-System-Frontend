import type { MachineTokenItem } from "#src/api/llm-factory/admin";
import {
	createMachineToken,
	listMachineTokens,

	revokeMachineToken,
} from "#src/api/llm-factory/admin";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { integer, maxLength, minLength, range, required, tokenName } from "#src/utils/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const { Paragraph, Text } = Typography;

const ALL_SCOPES = ["view", "train", "eval", "data", "admin"];

function formatTime(v: string | null): string {
	return v ? new Date(v).toLocaleString("zh-CN") : "—";
}

export default function MachineTokens() {
	const { t } = useTranslation();
	const token = useLlmTokens();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [newToken, setNewToken] = useState<string | null>(null);
	const [form] = Form.useForm<{ name: string, scopes: string[], ttl_days: number }>();
	const scopesRequiredRule = {
		validator: (_: unknown, value?: string[]) => {
			if (value?.length) {
				return Promise.resolve();
			}

			return Promise.reject(new Error(t("form.validation.scopesRequired", { defaultValue: "请至少选择一个 scope" })));
		},
	};
	const scopesMaxRule = {
		validator: (_: unknown, value?: string[]) => {
			if (!value || value.length <= ALL_SCOPES.length) {
				return Promise.resolve();
			}

			return Promise.reject(new Error(t("form.validation.scopesMax", { max: ALL_SCOPES.length, defaultValue: `最多选择 ${ALL_SCOPES.length} 个 scope` })));
		},
	};

	const { data, error, isError, isLoading, refetch } = useQuery({
		queryKey: ["admin", "machine-tokens"],
		queryFn: () => listMachineTokens().then(r => r.data),
	});

	const createMutation = useMutation({
		mutationFn: createMachineToken,
		onSuccess: (resp) => {
			setNewToken(resp.data.token);
			queryClient.invalidateQueries({ queryKey: ["admin", "machine-tokens"] });
			window.$message?.success("机器 token 已签发 (仅此次可见)");
		},
		onError: e => window.$message?.error(`签发失败: ${e instanceof Error ? e.message : String(e)}`),
	});

	const revokeMutation = useMutation({
		mutationFn: (id: number) => revokeMachineToken(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin", "machine-tokens"] });
			window.$message?.success("已吊销");
		},
		onError: e => window.$message?.error(`吊销失败: ${e instanceof Error ? e.message : String(e)}`),
	});

	const columns = [
		{ title: "名称", dataIndex: "name", width: 160 },
		{
			title: "scope",
			dataIndex: "scopes",
			width: 200,
			render: (v: string[]) => <Space size={4} wrap>{v?.map(s => <Tag key={s}>{s}</Tag>)}</Space>,
		},
		{ title: t("common.machineTokens.colIssuer"), dataIndex: "issuedBy", width: 100 },
		{ title: t("common.machineTokens.colIssuedAt"), dataIndex: "issuedAt", width: 170, render: formatTime },
		{ title: t("common.machineTokens.colExpiresAt"), dataIndex: "expiresAt", width: 170, render: formatTime },
		{ title: t("common.machineTokens.colLastUsedAt"), dataIndex: "lastUsedAt", width: 170, render: formatTime },
		{
			title: t("common.machineTokens.colStatus"),
			dataIndex: "revokedAt",
			width: 100,
			render: (v: string | null) => v ? <Tag color="red">{t("common.machineTokens.statusRevoked")}</Tag> : <Tag color="green">{t("common.machineTokens.statusActive")}</Tag>,
		},
		{
			title: t("common.machineTokens.colAction"),
			width: 100,
			render: (_: unknown, r: MachineTokenItem) => (
				<Popconfirm
					disabled={!!r.revokedAt}
					title={t("common.machineTokens.revokeConfirm", { name: r.name })}
					onConfirm={() => revokeMutation.mutate(r.id)}
				>
					<Button size="small" danger disabled={!!r.revokedAt}>{t("common.machineTokens.revoke")}</Button>
				</Popconfirm>
			),
		},
	];

	return (
		<div className="p-6">
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">{t("common.machineTokens.title")}</h2>
				<p style={{ margin: "4px 0 0 0", color: token.colorTextSecondary, fontSize: 14 }}>
					{t("common.machineTokens.description")}
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title={t("common.machineTokens.fallbackError")} />}

			<Card
				extra={(
					<Button
						type="primary"
						onClick={() => {
							form.resetFields();
							setNewToken(null);
							setOpen(true);
						}}
					>
						{t("common.machineTokens.issueNew")}
					</Button>
				)}
			>
				<Table<MachineTokenItem>
					rowKey="id"
					loading={isLoading}
					dataSource={data ?? []}
					columns={columns}
					pagination={{ pageSize: 20 }}
				/>
			</Card>

			<Modal
				open={open}
				title={t("common.machineTokens.issueTitle")}
				onCancel={() => setOpen(false)}
				footer={newToken
					? [<Button key="close" type="primary" onClick={() => setOpen(false)}>{t("common.machineTokens.done")}</Button>]
					: [
						<Button key="cancel" onClick={() => setOpen(false)}>{t("common.machineTokens.cancel")}</Button>,
						<Button key="ok" type="primary" loading={createMutation.isPending} onClick={() => form.submit()}>{t("common.machineTokens.issue")}</Button>,
					]}
			>
				{newToken
					? (
						<div>
							<Text type="warning">{t("common.machineTokens.plaintextWarning")}</Text>
							<Paragraph copyable code style={{ marginTop: 12, wordBreak: "break-all" }}>{newToken}</Paragraph>
						</div>
					)
					: (
						<Form
							form={form}
							layout="vertical"
							onFinish={v => createMutation.mutate({ name: v.name, scopes: v.scopes ?? [], ttl_days: v.ttl_days })}
						>
							<Form.Item name="name" label={t("common.machineTokens.fieldName")} rules={[required(), minLength(3), maxLength(64), tokenName()]}>
								<Input placeholder={t("common.machineTokens.fieldNamePlaceholder")} />
							</Form.Item>
							<Form.Item name="scopes" label="scope" initialValue={["view"]} rules={[required(t("form.validation.scopesRequired", { defaultValue: "请至少选择一个 scope" })), scopesRequiredRule, scopesMaxRule]}>
								<Select mode="multiple" options={ALL_SCOPES.map(scope => ({ label: scope, value: scope }))} placeholder={`可选: ${ALL_SCOPES.join(",")}`} />
							</Form.Item>
							<Form.Item name="ttl_days" label={t("common.machineTokens.fieldTtl")} rules={[required(), integer(), range(1, 365, t("form.validation.ttlRange", { defaultValue: "有效期需为 1 到 365 天" }))]}>
								<InputNumber min={1} max={365} className="w-full" placeholder="365" />
							</Form.Item>
						</Form>
					)}
			</Modal>
		</div>
	);
}
