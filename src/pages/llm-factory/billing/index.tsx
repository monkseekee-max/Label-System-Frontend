// ============================================================================
// 计费中心 (原生页面, 后端代理 new-api)
//
// 不再嵌入 new-api 控制台 iframe; 改为原生页面直接操作核心功能:
//   - 概览:  余额 / 已用 / 实时速率 (RPM/TPM)
//   - 充值:  创建订单 → 扫码 → 确认到账 (调后端 create-order/pay)
//   - 令牌:  创建 / 查看明文 key / 删除 (调后端代理 new-api /api/token)
//   - 用量:  消费日志明细 + 按模型/类型筛选 (调后端代理 new-api /api/log)
//
// 后端用管理员凭证调 new-api, 浏览器永不直连 new-api.
// ============================================================================

import type { BillingLog, BillingToken } from "#src/api/llm-factory/billing";
import {

	createRechargeOrder,
	createToken,
	deleteToken,
	fetchLogs,
	fetchQuota,
	fetchStats,
	fetchTokens,
	payRechargeOrder,
	revealTokenKey,
} from "#src/api/llm-factory/billing";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import {
	CopyOutlined,
	DeleteOutlined,
	PlusOutlined,
	ReloadOutlined,
	SafetyCertificateOutlined,
	ThunderboltOutlined,
	WalletOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	App,
	Button,
	Card,
	Col,
	Descriptions,
	Form,
	Input,
	InputNumber,
	Modal,
	QRCode,
	Row,
	Select,
	Space,
	Statistic,
	Table,
	Tag,
	Tooltip,
	Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";

const { Paragraph, Text, Title } = Typography;

const QUOTA_PER_YUAN = 50000; // 与后端一致: 1 元 = 50000 quota

const LOG_TYPE_MAP: Record<number, { label: string, color: string }> = {
	1: { label: "充值", color: "success" },
	2: { label: "消费", color: "processing" },
	3: { label: "管理", color: "default" },
	4: { label: "错误", color: "error" },
};

function yuan(v: number | undefined, digits = 2): number {
	return Number((v ?? 0).toFixed(digits));
}

export default function BillingCenter() {
	const tokens = useLlmTokens();
	const { message } = App.useApp();
	const queryClient = useQueryClient();
	const [tab, setTab] = useState("overview");

	// —— 额度 (轮询, 概览页用) ——
	const quotaQuery = useQuery({
		queryKey: ["billing-quota"],
		queryFn: fetchQuota,
		refetchInterval: 15000,
		retry: 1,
	});
	const quota = quotaQuery.data?.success ? quotaQuery.data.data : null;

	const invalidateAll = () => {
		queryClient.invalidateQueries({ queryKey: ["billing-quota"] });
		queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
		queryClient.invalidateQueries({ queryKey: ["billing-tokens"] });
		queryClient.invalidateQueries({ queryKey: ["billing-logs"] });
	};

	return (
		<Space orientation="vertical" size={16} className="w-full">
			<Card variant="borderless" style={{ background: tokens.colorPrimaryBg }}>
				<Space align="center" className="w-full">
					<WalletOutlined style={{ fontSize: 30, color: tokens.colorPrimary }} />
					<div>
						<Title level={3} className="mb-1">
							计费中心
						</Title>
						<Paragraph type="secondary" className="mb-0">
							账户余额、在线充值、API 令牌管理与用量明细。
						</Paragraph>
					</div>
					<Button
						icon={<ReloadOutlined />}
						style={{ marginLeft: "auto" }}
						onClick={() => invalidateAll()}
					>
						刷新
					</Button>
				</Space>
			</Card>

			{quotaQuery.isError && (
				<QueryErrorAlert error={quotaQuery.error} onRetry={() => void quotaQuery.refetch()} title="额度数据不可用" />
			)}

			{tab === "overview" && <OverviewTab quota={quota} quotaLoading={quotaQuery.isLoading} onGoRecharge={() => setTab("recharge")} />}
			{tab === "recharge" && <RechargeTab onPaid={invalidateAll} />}
			{tab === "tokens" && <TokensTab notify={message} />}
			{tab === "logs" && <LogsTab />}

			<Space style={{ marginTop: 8, justifyContent: "center" }} className="w-full">
				{["overview", "recharge", "tokens", "logs"].map((key) => {
					const labels: Record<string, string> = { overview: "概览", recharge: "充值", tokens: "API 令牌", logs: "用量明细" };
					const active = tab === key;
					return (
						<Button
							key={key}
							type={active ? "primary" : "default"}
							onClick={() => setTab(key)}
						>
							{labels[key]}
						</Button>
					);
				})}
			</Space>
		</Space>
	);
}

// ============================================================
// 概览
// ============================================================
function OverviewTab({ quota, quotaLoading, onGoRecharge }: { quota: { remaining_yuan: number, used_yuan: number, quota: number, used_quota: number } | null, quotaLoading: boolean, onGoRecharge: () => void }) {
	const tokens = useLlmTokens();
	const statsQuery = useQuery({ queryKey: ["billing-stats"], queryFn: fetchStats, refetchInterval: 15000, retry: 1 });
	const stats = statsQuery.data?.success ? statsQuery.data.data : null;

	return (
		<Row gutter={[16, 16]}>
			<Col xs={24} lg={8}>
				<Card variant="borderless">
					<Statistic
						title="可用余额"
						prefix={<SafetyCertificateOutlined />}
						value={yuan(quota?.remaining_yuan)}
						precision={2}
						suffix="元"
						styles={{ content: { color: tokens.colorSuccess } }}
						loading={quotaLoading}
					/>
				</Card>
			</Col>
			<Col xs={24} lg={8}>
				<Card variant="borderless">
					<Statistic
						title="累计消费"
						value={yuan(quota?.used_yuan)}
						precision={2}
						suffix="元"
						styles={{ content: { color: tokens.colorWarning } }}
						loading={quotaLoading}
					/>
				</Card>
			</Col>
			<Col xs={24} lg={8}>
				<Card variant="borderless">
					<Statistic
						title="剩余额度"
						value={quota?.quota ?? 0}
						loading={quotaLoading}
						suffix={<Text type="secondary" className="text-xs">quota</Text>}
					/>
				</Card>
			</Col>

			<Col xs={24}>
				<Card
					variant="borderless"
					title={(
						<Space>
							<ThunderboltOutlined />
							{" "}
							实时速率
						</Space>
					)}
				>
					<Row gutter={[16, 16]}>
						<Col xs={12} lg={8}>
							<Statistic title="每分钟请求数 (RPM)" value={stats?.rpm ?? 0} loading={statsQuery.isLoading} />
						</Col>
						<Col xs={12} lg={8}>
							<Statistic title="每分钟 Token (TPM)" value={stats?.tpm ?? 0} loading={statsQuery.isLoading} />
						</Col>
						<Col xs={24} lg={8}>
							<div style={{ display: "flex", alignItems: "center", height: "100%" }}>
								<Button type="primary" size="large" icon={<WalletOutlined />} onClick={onGoRecharge}>
									立即充值
								</Button>
							</div>
						</Col>
					</Row>
				</Card>
			</Col>
		</Row>
	);
}

// ============================================================
// 充值
// ============================================================
function RechargeTab({ onPaid }: { onPaid: () => void }) {
	const tokens = useLlmTokens();
	const { message } = App.useApp();
	const [amount, setAmount] = useState(50);
	const [currentOrder, setCurrentOrder] = useState<{ order_id: string, amount_yuan: number, quota: number, qr_content: string } | null>(null);

	const createMutation = useMutation({
		mutationFn: () => createRechargeOrder(amount),
		onSuccess: (res) => {
			if (res.success && res.data) {
				setCurrentOrder(res.data);
				message.success("订单已创建，扫码或点击下方按钮完成支付");
			}
			else {
				message.error(res.error || "创建订单失败");
			}
		},
		onError: (e: Error) => message.error(`创建订单失败: ${e.message}`),
	});

	const payMutation = useMutation({
		mutationFn: (orderId: string) => payRechargeOrder(orderId),
		onSuccess: (res) => {
			if (res.success) {
				message.success(`充值成功，已到账 ${currentOrder?.amount_yuan ?? 0} 元`);
				setCurrentOrder(null);
				onPaid();
			}
			else {
				message.error(res.error || "支付确认失败");
			}
		},
		onError: (e: Error) => message.error(`支付失败: ${e.message}`),
	});

	const presets = [10, 50, 100, 500];

	return (
		<Row gutter={[16, 16]}>
			<Col xs={24} lg={12}>
				<Card variant="borderless" title="选择充值金额">
					<Space wrap size={12}>
						{presets.map(v => (
							<Button
								key={v}
								type={amount === v ? "primary" : "default"}
								onClick={() => setAmount(v)}
								style={{ width: 90 }}
							>
								¥
								{v}
							</Button>
						))}
					</Space>
					<div style={{ marginTop: 20 }}>
						<Text type="secondary">自定义金额 (元):</Text>
						<InputNumber
							min={1}
							max={10000}
							value={amount}
							onChange={v => setAmount(Number(v ?? 0))}
							style={{ width: "100%", marginTop: 8 }}
							parser={v => Math.floor(Number(v || 0))}
						/>
					</div>
					<Descriptions column={1} size="small" style={{ marginTop: 16 }}>
						<Descriptions.Item label="充值金额">
							<Text strong>
								¥
								{amount}
							</Text>
						</Descriptions.Item>
						<Descriptions.Item label="将到账额度">
							<Tag color="blue">
								{(amount * QUOTA_PER_YUAN).toLocaleString()}
								{" "}
								quota
							</Tag>
							<Text type="secondary" className="text-xs">
								{" "}
								(1元 =
								{QUOTA_PER_YUAN}
								{" "}
								quota)
							</Text>
						</Descriptions.Item>
					</Descriptions>
					<Button
						type="primary"
						size="large"
						block
						style={{ marginTop: 16 }}
						loading={createMutation.isPending}
						onClick={() => createMutation.mutate()}
					>
						生成充值订单
					</Button>
				</Card>
			</Col>
			<Col xs={24} lg={12}>
				<Card variant="borderless" title="扫码支付">
					{currentOrder
						? (
							<div style={{ textAlign: "center" }}>
								<QRCode
									value={currentOrder.qr_content}
									size={200}
									style={{ margin: "0 auto 16px" }}
									color={tokens.colorPrimary}
								/>
								<Descriptions column={1} size="small" style={{ maxWidth: 320, margin: "0 auto" }}>
									<Descriptions.Item label="订单号">{currentOrder.order_id}</Descriptions.Item>
									<Descriptions.Item label="金额">
										<Text strong>
											¥
											{currentOrder.amount_yuan}
										</Text>
									</Descriptions.Item>
								</Descriptions>
								<Button
									type="primary"
									size="large"
									style={{ marginTop: 16 }}
									loading={payMutation.isPending}
									onClick={() => payMutation.mutate(currentOrder.order_id)}
								>
									我已完成支付
								</Button>
								<Paragraph type="secondary" className="mt-3 text-xs">
									演示模式：点击「我已完成支付」即时到账并写入额度。
								</Paragraph>
							</div>
						)
						: (
							<div style={{ textAlign: "center", padding: "48px 0", color: tokens.colorTextSecondary }}>
								<WalletOutlined style={{ fontSize: 48, opacity: 0.3 }} />
								<Paragraph type="secondary" className="mt-3">
									生成订单后此处显示支付二维码
								</Paragraph>
							</div>
						)}
				</Card>
			</Col>
		</Row>
	);
}

// ============================================================
// API 令牌
// ============================================================
function TokensTab({ notify }: { notify: { success: (m: string) => void, error: (m: string) => void } }) {
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [createForm] = Form.useForm();

	const query = useQuery({ queryKey: ["billing-tokens"], queryFn: fetchTokens, retry: 1 });
	const items = query.data?.data?.items ?? [];

	const createMutation = useMutation({
		mutationFn: (payload: { name: string, unlimited_quota: boolean, remain_quota: number }) => createToken(payload),
		onSuccess: async (res) => {
			if (res.success) {
				notify.success("令牌创建成功");
				setCreateOpen(false);
				createForm.resetFields();
				await queryClient.invalidateQueries({ queryKey: ["billing-tokens"] });
			}
			else {
				notify.error(res.message || "创建失败");
			}
		},
		onError: (e: Error) => notify.error(`创建失败: ${e.message}`),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteToken(id),
		onSuccess: async (res) => {
			if (res.success) {
				notify.success("令牌已删除");
				await queryClient.invalidateQueries({ queryKey: ["billing-tokens"] });
			}
			else {
				notify.error(res.message || "删除失败");
			}
		},
		onError: (e: Error) => notify.error(`删除失败: ${e.message}`),
	});

	const copyKey = (key: string) => {
		navigator.clipboard?.writeText(key);
		notify.success("已复制");
	};

	const revealMutation = useMutation({
		mutationFn: (id: number) => revealTokenKey(id),
		onSuccess: (res) => {
			if (res.success && res.data?.key) {
				Modal.info({
					title: "令牌密钥 (仅展示一次)",
					content: (
						<Input.Group compact>
							<Input style={{ width: "calc(100% - 80px)" }} value={res.data.key} readOnly />
							<Button
								style={{ width: 80 }}
								icon={<CopyOutlined />}
								onClick={() => copyKey(res.data.key)}
							>
								复制
							</Button>
						</Input.Group>
					),
				});
			}
			else {
				notify.error(res.message || "获取密钥失败");
			}
		},
		onError: (e: Error) => notify.error(`获取密钥失败: ${e.message}`),
	});

	const columns = [
		{
			title: "名称",
			dataIndex: "name",
			render: (v: string, r: BillingToken) => (
				<Space>
					<Text strong>{v}</Text>
					{r.unlimited_quota ? <Tag color="green">不限额</Tag> : <Tag color="orange">限额</Tag>}
				</Space>
			),
		},
		{ title: "Key", dataIndex: "key", render: (v: string) => <Text code className="text-xs">{v}</Text> },
		{
			title: "状态",
			dataIndex: "status",
			render: (s: number) => (
				<Tag color={s === 1 ? "success" : s === 2 ? "warning" : "default"}>
					{s === 1 ? "启用" : s === 2 ? "禁用" : "过期"}
				</Tag>
			),
		},
		{
			title: "已用 / 剩余",
			render: (_: unknown, r: BillingToken) => (
				<Space direction="vertical" size={0} className="text-xs">
					<Text type="secondary">
						已用
						{(r.used_quota ?? 0).toLocaleString()}
					</Text>
					<Text type="secondary">
						剩余
						{r.unlimited_quota ? "∞" : (r.remain_quota ?? 0).toLocaleString()}
					</Text>
				</Space>
			),
		},
		{ title: "分组", dataIndex: "group", render: (v: string) => <Tag>{v}</Tag> },
		{
			title: "创建时间",
			dataIndex: "created_time",
			render: (t: number) => (t ? dayjs.unix(t).format("YYYY-MM-DD HH:mm") : "-"),
		},
		{
			title: "操作",
			key: "op",
			render: (_: unknown, r: BillingToken) => (
				<Space>
					<Tooltip title="查看明文密钥 (仅展示一次)">
						<Button size="small" icon={<CopyOutlined />} loading={revealMutation.isPending} onClick={() => revealMutation.mutate(r.id)}>密钥</Button>
					</Tooltip>
					<Button size="small" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(r.id)}>删除</Button>
				</Space>
			),
		},
	];

	return (
		<Card
			variant="borderless"
			title={(
				<Space>
					<SafetyCertificateOutlined />
					{" "}
					API 令牌
				</Space>
			)}
			extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建令牌</Button>}
		>
			<Paragraph type="secondary" className="mb-3">
				调用推理与标注 API 时使用的密钥。明文密钥仅在创建时展示一次，请妥善保存。
			</Paragraph>
			<Table
				rowKey="id"
				size="small"
				loading={query.isLoading}
				dataSource={items}
				columns={columns}
				pagination={{ pageSize: 10, showSizeChanger: false }}
				locale={{ emptyText: "暂无令牌" }}
			/>

			<Modal
				title="新建 API 令牌"
				open={createOpen}
				onCancel={() => setCreateOpen(false)}
				confirmLoading={createMutation.isPending}
				onOk={() => createForm.validateFields().then(v => createMutation.mutate({
					name: v.name,
					unlimited_quota: !!v.unlimited_quota,
					remain_quota: Number(v.remain_quota ?? 0),
				}))}
			>
				<Form form={createForm} layout="vertical" initialValues={{ unlimited_quota: true, remain_quota: 0 }}>
					<Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入令牌名称" }]}>
						<Input placeholder="例如：生产环境" maxLength={64} />
					</Form.Item>
					<Form.Item name="unlimited_quota" label="额度" valuePropName="checked">
						<Select
							value={createForm.getFieldValue("unlimited_quota") ? 1 : 0}
							onChange={v => createForm.setFieldValue("unlimited_quota", v === 1)}
							options={[
								{ value: 1, label: "不限额度" },
								{ value: 0, label: "固定额度" },
							]}
						/>
					</Form.Item>
					{!createForm.getFieldValue("unlimited_quota") && (
						<Form.Item name="remain_quota" label="剩余 quota">
							<InputNumber min={0} style={{ width: "100%" }} />
						</Form.Item>
					)}
				</Form>
			</Modal>
		</Card>
	);
}

// ============================================================
// 用量明细
// ============================================================
function LogsTab() {
	const tokens = useLlmTokens();
	const [filters, setFilters] = useState<{ type: number, model: string, token_name: string }>({ type: 0, model: "", token_name: "" });
	const query = useQuery({
		queryKey: ["billing-logs", filters],
		queryFn: () => fetchLogs({ page: 1, page_size: 50, type: filters.type, model: filters.model, token_name: filters.token_name }),
		retry: 1,
	});

	const items = query.data?.data?.items ?? [];
	const totalQuota = items.reduce((s, l) => s + (l.quota ?? 0), 0);
	const totalTokens = items.reduce((s, l) => s + (l.prompt_tokens ?? 0) + (l.completion_tokens ?? 0), 0);

	const columns = [
		{
			title: "时间",
			dataIndex: "created_at",
			width: 150,
			render: (t: number) => (t ? dayjs.unix(t).format("MM-DD HH:mm:ss") : "-"),
		},
		{
			title: "类型",
			dataIndex: "type",
			width: 80,
			render: (t: number) => {
				const m = LOG_TYPE_MAP[t] || { label: "其他", color: "default" };
				return <Tag color={m.color}>{m.label}</Tag>;
			},
		},
		{ title: "模型", dataIndex: "model_name", render: (v: string) => v ? <Tag color="blue">{v}</Tag> : "-" },
		{ title: "令牌", dataIndex: "token_name", ellipsis: true },
		{ title: "渠道", dataIndex: "channel_name", ellipsis: true },
		{
			title: "Token (入/出)",
			width: 130,
			render: (_: unknown, r: BillingLog) => (
				<Text className="text-xs">
					{r.prompt_tokens ?? 0}
					{" "}
					/
					{r.completion_tokens ?? 0}
				</Text>
			),
		},
		{
			title: "消费 quota",
			dataIndex: "quota",
			width: 120,
			sorter: (a: BillingLog, b: BillingLog) => (a.quota ?? 0) - (b.quota ?? 0),
			render: (q: number) => <Text strong style={{ color: tokens.colorWarning }}>{(q ?? 0).toLocaleString()}</Text>,
		},
		{ title: "耗时", dataIndex: "use_time", width: 80, render: (t: number) => (t != null ? `${t}s` : "-") },
	];

	return (
		<Card
			variant="borderless"
			title={(
				<Space>
					<ThunderboltOutlined />
					{" "}
					用量明细
				</Space>
			)}
		>
			<Space wrap className="mb-3">
				<Select
					style={{ width: 130 }}
					placeholder="类型"
					allowClear
					value={filters.type || undefined}
					onChange={v => setFilters(f => ({ ...f, type: Number(v ?? 0) }))}
					options={[
						{ value: 2, label: "消费" },
						{ value: 1, label: "充值" },
						{ value: 3, label: "管理" },
						{ value: 4, label: "错误" },
					]}
				/>
				<Input
					style={{ width: 160 }}
					placeholder="模型名 (如 qwen3-8b)"
					allowClear
					onChange={e => setFilters(f => ({ ...f, model: e.target.value }))}
				/>
				<Input
					style={{ width: 160 }}
					placeholder="令牌名"
					allowClear
					onChange={e => setFilters(f => ({ ...f, token_name: e.target.value }))}
				/>
				<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>刷新</Button>
			</Space>

			<Row gutter={[16, 16]} className="mb-3">
				<Col xs={12} lg={8}>
					<Card variant="borderless" size="small">
						<Statistic title="本页消费" value={totalQuota} suffix="quota" />
					</Card>
				</Col>
				<Col xs={12} lg={8}>
					<Card variant="borderless" size="small">
						<Statistic title="本页 Token" value={totalTokens} />
					</Card>
				</Col>
				<Col xs={24} lg={8}>
					<Card variant="borderless" size="small">
						<Statistic title="总记录数" value={query.data?.data?.total ?? 0} />
					</Card>
				</Col>
			</Row>

			<Table
				rowKey="id"
				size="small"
				loading={query.isLoading}
				dataSource={items}
				columns={columns}
				pagination={{ pageSize: 20, showSizeChanger: false }}
				locale={{ emptyText: "暂无用量记录" }}
			/>
		</Card>
	);
}
