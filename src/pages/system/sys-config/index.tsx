import type { ConfigStatus, ConfigType, SaveSysConfigRequest, SysConfigResponse } from "#src/api/sys-configs";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { createSysConfig, fetchSysConfigDetail, fetchSysConfigs, updateSysConfig } from "#src/api/sys-configs";
import { BasicContent } from "#src/components/basic-content";
import { BasicTable } from "#src/components/basic-table";
import { PlusOutlined } from "@ant-design/icons";
import { ModalForm, ProFormDependency, ProFormSelect, ProFormText, ProFormTextArea } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Descriptions, Drawer, Input, Select, Space, Tag } from "antd";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const CONFIG_TYPE_OPTIONS: Array<{ label: string, value: ConfigType }> = [
	{ label: "大模型配置", value: "MODEL" },
	{ label: "提示词配置", value: "PROMPT" },
	{ label: "系统配置", value: "SYSTEM" },
];

const STATUS_OPTIONS: Array<{ label: string, value: ConfigStatus }> = [
	{ label: "启用", value: "ENABLED" },
	{ label: "禁用", value: "DISABLED" },
];

const STATUS_COLORS: Record<ConfigStatus, string> = {
	ENABLED: "success",
	DISABLED: "default",
};

interface SysConfigFormValues {
	configType: ConfigType
	configName: string
	configValue?: string
	status: ConfigStatus
	llmType?: string
	modelName?: string
	modelUrl?: string
	apiKey?: string
	provider?: string
	defaultBucket?: string
}

function safeParseJson(value: string) {
	try {
		return JSON.parse(value) as Record<string, unknown>;
	}
	catch {
		return null;
	}
}

function buildConfigValue(values: SysConfigFormValues) {
	if (values.configType === "MODEL") {
		return JSON.stringify({
			llmType: values.llmType || "",
			modelName: values.modelName ? values.modelName : null,
			modelUrl: values.modelUrl || "",
			apiKey: values.apiKey || "",
		});
	}
	if (values.configType === "SYSTEM") {
		return JSON.stringify({
			provider: values.provider || "",
			defaultBucket: values.defaultBucket || "",
		});
	}
	return values.configValue || "";
}

function getInitialFormValues(config?: SysConfigResponse): Partial<SysConfigFormValues> | undefined {
	if (!config) {
		return undefined;
	}
	const parsed = safeParseJson(config.configValue);
	return {
		configType: config.configType,
		configName: config.configName,
		configValue: config.configValue,
		status: config.status,
		llmType: typeof parsed?.llmType === "string" ? parsed.llmType : undefined,
		modelName: typeof parsed?.modelName === "string" ? parsed.modelName : undefined,
		modelUrl: typeof parsed?.modelUrl === "string" ? parsed.modelUrl : undefined,
		apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey : undefined,
		provider: typeof parsed?.provider === "string" ? parsed.provider : undefined,
		defaultBucket: typeof parsed?.defaultBucket === "string" ? parsed.defaultBucket : undefined,
	};
}

export default function SysConfigPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const actionRef = useRef<ActionType>(null);

	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [configType, setConfigType] = useState<ConfigType | undefined>();
	const [status, setStatus] = useState<ConfigStatus | undefined>();
	const [configName, setConfigName] = useState<string | undefined>();
	const [configNameInput, setConfigNameInput] = useState("");

	const [createOpen, setCreateOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [detailId, setDetailId] = useState<number | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);

	const params = useMemo(() => ({ pageNo, pageSize, configType, status, configName }), [configName, configType, pageNo, pageSize, status]);

	const { data, isLoading } = useQuery({
		queryKey: ["sys-configs", "list", params],
		queryFn: () => fetchSysConfigs(params).then(r => r.result),
	});

	const { data: editingData } = useQuery({
		queryKey: ["sys-configs", "detail", editingId],
		queryFn: () => fetchSysConfigDetail(editingId!).then(r => r.result),
		enabled: editingId !== null,
	});

	const { data: detail, isLoading: detailLoading } = useQuery({
		queryKey: ["sys-configs", "detail", detailId],
		queryFn: () => fetchSysConfigDetail(detailId!).then(r => r.result),
		enabled: detailId !== null,
	});
	const parsedDetailConfig = useMemo(() => detail ? safeParseJson(detail.configValue) : null, [detail]);

	const createMutation = useMutation({
		mutationFn: createSysConfig,
		onSuccess: () => {
			window.$message?.success("创建成功");
			void queryClient.invalidateQueries({ queryKey: ["sys-configs"] });
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, data }: { id: number, data: SaveSysConfigRequest }) => updateSysConfig(id, data),
		onSuccess: () => {
			window.$message?.success("更新成功");
			void queryClient.invalidateQueries({ queryKey: ["sys-configs"] });
		},
	});

	function openEdit(id: number) {
		setEditingId(id);
		setEditOpen(true);
	}

	function openDetail(id: number) {
		setDetailId(id);
		setDetailOpen(true);
	}

	const columns: ProColumns<SysConfigResponse>[] = [
		{ title: t("common.index"), valueType: "index", width: 60 },
		{ title: "ID", dataIndex: "id", width: 90 },
		{
			title: "配置类型",
			dataIndex: "configType",
			width: 120,
			render: (_, row) => CONFIG_TYPE_OPTIONS.find(opt => opt.value === row.configType)?.label || row.configType,
		},
		{ title: "配置名称", dataIndex: "configName", width: 220, ellipsis: true },
		{ title: "配置值", dataIndex: "configValue", ellipsis: true },
		{
			title: "状态",
			dataIndex: "status",
			width: 100,
			render: (_, row) => <Tag color={STATUS_COLORS[row.status]}>{row.status === "ENABLED" ? "启用" : "禁用"}</Tag>,
		},
		{ title: t("common.createTime"), dataIndex: "createdAt", width: 170, valueType: "dateTime" },
		{ title: t("common.updateTime"), dataIndex: "updatedAt", width: 170, valueType: "dateTime" },
		{
			title: t("common.action"),
			valueType: "option",
			width: 160,
			fixed: "right",
			render: (_, row) => [
				<Button key="view" type="link" size="small" onClick={() => openDetail(row.id)}>详情</Button>,
				<Button key="edit" type="link" size="small" onClick={() => openEdit(row.id)}>编辑</Button>,
			],
		},
	];

	return (
		<BasicContent>
			<BasicTable<SysConfigResponse>
				actionRef={actionRef}
				rowKey="id"
				loading={isLoading}
				dataSource={data?.records}
				columns={columns}
				search={false}
				pagination={{
					current: pageNo,
					pageSize,
					total: data?.total ?? 0,
					showSizeChanger: true,
					onChange: (page, size) => {
						setPageNo(page);
						setPageSize(size);
					},
				}}
				toolBarRender={() => [
					<Space key="filters" wrap>
						<Input.Search
							allowClear
							placeholder="配置名称"
							className="w-[180px]"
							value={configNameInput}
							onChange={e => setConfigNameInput(e.target.value)}
							onSearch={(value) => {
								setConfigName(value || undefined);
								setPageNo(1);
							}}
						/>
						<Select
							allowClear
							placeholder="配置类型"
							className="w-[140px]"
							options={CONFIG_TYPE_OPTIONS}
							value={configType}
							onChange={(value) => {
								setConfigType(value);
								setPageNo(1);
							}}
						/>
						<Select
							allowClear
							placeholder="状态"
							className="w-[120px]"
							options={STATUS_OPTIONS}
							value={status}
							onChange={(value) => {
								setStatus(value);
								setPageNo(1);
							}}
						/>
					</Space>,
					<Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
						新增配置
					</Button>,
				]}
			/>

			<ModalForm<SysConfigFormValues>
				title="新增系统配置"
				open={createOpen}
				onOpenChange={setCreateOpen}
				modalProps={{ destroyOnHidden: true }}
				onFinish={async (values: SysConfigFormValues) => {
					const payload: SaveSysConfigRequest = {
						configType: values.configType,
						configName: values.configName,
						status: values.status,
						configValue: buildConfigValue(values),
					};
					await createMutation.mutateAsync(payload);
					return true;
				}}
			>
				<ProFormSelect name="configType" label="配置类型" options={CONFIG_TYPE_OPTIONS} rules={[{ required: true }]} />
				<ProFormText name="configName" label="配置名称" rules={[{ required: true }]} />
				<ProFormDependency name={["configType"]}>
					{({ configType }) => {
						if (configType === "MODEL") {
							return (
								<>
									<ProFormText name="llmType" label="LLM 类型" rules={[{ required: true }]} />
									<ProFormText name="modelName" label="模型名称" rules={[{ required: true }]} />
									<ProFormText name="modelUrl" label="模型 URL" rules={[{ required: true }]} />
									<ProFormText name="apiKey" label="API Key" rules={[{ required: true }]} />
								</>
							);
						}
						if (configType === "SYSTEM") {
							return (
								<>
									<ProFormText name="provider" label="Provider" rules={[{ required: true }]} />
									<ProFormText name="defaultBucket" label="默认 Bucket" rules={[{ required: true }]} />
								</>
							);
						}
						return <ProFormTextArea name="configValue" label="配置值" rules={[{ required: true }]} fieldProps={{ rows: 5 }} />;
					}}
				</ProFormDependency>
				<ProFormSelect name="status" label="状态" options={STATUS_OPTIONS} initialValue="ENABLED" rules={[{ required: true }]} />
			</ModalForm>

			<ModalForm<SysConfigFormValues>
				title="编辑系统配置"
				open={editOpen}
				onOpenChange={(open) => {
					setEditOpen(open);
					if (!open)
						setEditingId(null);
				}}
				modalProps={{ destroyOnHidden: true }}
				initialValues={getInitialFormValues(editingData)}
				onFinish={async (values) => {
					if (!editingId)
						return false;
					const payload: SaveSysConfigRequest = {
						configType: values.configType,
						configName: values.configName,
						status: values.status,
						configValue: buildConfigValue(values),
					};
					await updateMutation.mutateAsync({ id: editingId, data: payload });
					return true;
				}}
			>
				<ProFormSelect name="configType" label="配置类型" options={CONFIG_TYPE_OPTIONS} rules={[{ required: true }]} />
				<ProFormText name="configName" label="配置名称" rules={[{ required: true }]} />
				<ProFormDependency name={["configType"]}>
					{({ configType }) => {
						if (configType === "MODEL") {
							return (
								<>
									<ProFormText name="llmType" label="LLM 类型" rules={[{ required: true }]} />
									<ProFormText name="modelName" label="模型名称" rules={[{ required: true }]} />
									<ProFormText name="modelUrl" label="模型 URL" rules={[{ required: true }]} />
									<ProFormText name="apiKey" label="API Key" rules={[{ required: true }]} />
								</>
							);
						}
						if (configType === "SYSTEM") {
							return (
								<>
									<ProFormText name="provider" label="Provider" rules={[{ required: true }]} />
									<ProFormText name="defaultBucket" label="默认 Bucket" rules={[{ required: true }]} />
								</>
							);
						}
						return <ProFormTextArea name="configValue" label="配置值" rules={[{ required: true }]} fieldProps={{ rows: 5 }} />;
					}}
				</ProFormDependency>
				<ProFormSelect name="status" label="状态" options={STATUS_OPTIONS} rules={[{ required: true }]} />
			</ModalForm>

			<Drawer
				title="配置详情"
				open={detailOpen}
				onClose={() => setDetailOpen(false)}
				size={700}
				loading={detailLoading}
			>
				{detail && (
					<Descriptions bordered column={1} size="small">
						<Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
						<Descriptions.Item label="配置类型">{CONFIG_TYPE_OPTIONS.find(opt => opt.value === detail.configType)?.label || detail.configType}</Descriptions.Item>
						<Descriptions.Item label="配置名称">{detail.configName}</Descriptions.Item>
						<Descriptions.Item label="状态">{detail.status === "ENABLED" ? "启用" : "禁用"}</Descriptions.Item>
						{detail.configType === "MODEL"
							? (
								<>
									<Descriptions.Item label="LLM 类型">{String(parsedDetailConfig?.llmType ?? "-")}</Descriptions.Item>
									<Descriptions.Item label="模型名称">{String(parsedDetailConfig?.modelName ?? "-")}</Descriptions.Item>
									<Descriptions.Item label="模型 URL">{String(parsedDetailConfig?.modelUrl ?? "-")}</Descriptions.Item>
									<Descriptions.Item label="API Key">{String(parsedDetailConfig?.apiKey ?? "-")}</Descriptions.Item>
								</>
							)
							: null}
						{detail.configType === "SYSTEM"
							? (
								<>
									<Descriptions.Item label="Provider">{String(parsedDetailConfig?.provider ?? "-")}</Descriptions.Item>
									<Descriptions.Item label="默认 Bucket">{String(parsedDetailConfig?.defaultBucket ?? "-")}</Descriptions.Item>
								</>
							)
							: null}
						{detail.configType === "PROMPT"
							? (
								<Descriptions.Item label="配置值">
									<pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{detail.configValue}</pre>
								</Descriptions.Item>
							)
							: null}
						<Descriptions.Item label={t("common.createTime")}>{detail.createdAt}</Descriptions.Item>
						<Descriptions.Item label={t("common.updateTime")}>{detail.updatedAt}</Descriptions.Item>
					</Descriptions>
				)}
			</Drawer>
		</BasicContent>
	);
}
