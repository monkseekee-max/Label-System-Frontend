import type { CompanyResponse, CreateCompanyRequest } from "#src/api/platform/companies";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { createCompany, deleteCompany, fetchCompanyList, updateCompany, updateCompanyStatus } from "#src/api/platform/companies";
import { BasicContent } from "#src/components/basic-content";
import { BasicTable } from "#src/components/basic-table";
import {
	BankOutlined,
	IdcardOutlined,
	SettingOutlined,
	TeamOutlined,
	WalletOutlined,
} from "@ant-design/icons";
import {
	ModalForm,
	ProFormText,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Popconfirm, Spin, Tabs, Tag } from "antd";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// ============================================================================
// 企业管理中心 — 一站式整合企业管理 / 企业管理员 / 人员管理 / 系统配置 / 计费中心
// 用 Tabs 聚合, 进入「企业管理」即可访问全部治理功能, 无需在侧边栏分散入口。
// ============================================================================

// 懒加载整合进来的功能模块 (避免首屏一次性加载 + 触发其内部 query/轮询)
const CompanyAdminsTab = lazy(() => import("#src/pages/platform/company-admins"));
const UserTab = lazy(() => import("#src/pages/system/user"));
const SysConfigTab = lazy(() => import("#src/pages/system/sys-config"));
const BillingTab = lazy(() => import("#src/pages/llm-factory/billing"));

const TAB_KEYS = {
	companies: "companies",
	companyAdmins: "company-admins",
	user: "user",
	sysConfig: "sys-config",
	billing: "billing",
} as const;

const LazyFallback = (
	<div className="flex justify-center p-16">
		<Spin />
	</div>
);

export default function Companies() {
	// 「已访问才渲染」: 默认只渲染企业管理 tab;
	// 切换过的 tab 保持挂载 (保留状态/避免重复请求), 未访问的不触发其内部 query。
	// 这对计费中心尤其重要 (它有 quota/stats 15s 轮询)。
	const [activeKey, setActiveKey] = useState<string>(TAB_KEYS.companies);
	const [visited, setVisited] = useState<Set<string>>(() => new Set([TAB_KEYS.companies]));

	const handleChange = useCallback((key: string) => {
		setActiveKey(key);
		setVisited(prev => (prev.has(key) ? prev : new Set(prev).add(key)));
	}, []);

	const items = [
		{
			key: TAB_KEYS.companies,
			label: (
				<span>
					<BankOutlined />
					{" "}
					企业管理
				</span>
			),
			children: visited.has(TAB_KEYS.companies) ? <CompaniesTab /> : null,
		},
		{
			key: TAB_KEYS.companyAdmins,
			label: (
				<span>
					<IdcardOutlined />
					{" "}
					企业管理员
				</span>
			),
			children: visited.has(TAB_KEYS.companyAdmins)
				? <Suspense fallback={LazyFallback}><CompanyAdminsTab /></Suspense>
				: null,
		},
		{
			key: TAB_KEYS.user,
			label: (
				<span>
					<TeamOutlined />
					{" "}
					人员管理
				</span>
			),
			children: visited.has(TAB_KEYS.user)
				? <Suspense fallback={LazyFallback}><UserTab /></Suspense>
				: null,
		},
		{
			key: TAB_KEYS.sysConfig,
			label: (
				<span>
					<SettingOutlined />
					{" "}
					系统配置
				</span>
			),
			children: visited.has(TAB_KEYS.sysConfig)
				? <Suspense fallback={LazyFallback}><SysConfigTab /></Suspense>
				: null,
		},
		{
			key: TAB_KEYS.billing,
			label: (
				<span>
					<WalletOutlined />
					{" "}
					计费中心
				</span>
			),
			children: visited.has(TAB_KEYS.billing)
				? <Suspense fallback={LazyFallback}><BillingTab /></Suspense>
				: null,
		},
	];

	return (
		<BasicContent>
			<Tabs
				activeKey={activeKey}
				onChange={handleChange}
				items={items}
			/>
		</BasicContent>
	);
}

// ============================================================
// 企业管理 Tab (原企业管理表格逻辑, 增删改查企业)
// ============================================================
function CompaniesTab() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const actionRef = useRef<ActionType>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<CompanyResponse | null>(null);

	const { data: companies, isLoading } = useQuery({
		queryKey: ["platform-companies", "list"],
		queryFn: () => fetchCompanyList().then(r => r.result ?? []),
	});

	const createMutation = useMutation({
		mutationFn: createCompany,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
			window.$message?.success(t("common.addSuccess"));
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ companyId, status }: { companyId: number, status: "ENABLED" | "DISABLED" }) =>
			updateCompanyStatus(companyId, { status }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
			window.$message?.success(t("common.updateSuccess"));
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (companyId: number) => deleteCompany(companyId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
			window.$message?.success(t("common.deleteSuccess"));
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ companyId, data }: { companyId: number, data: CreateCompanyRequest }) =>
			updateCompany(companyId, data),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
			window.$message?.success(t("common.updateSuccess"));
		},
	});

	const columns: ProColumns<CompanyResponse>[] = [
		{ title: t("common.index"), valueType: "index", width: 60 },
		{ title: "企业编码", dataIndex: "companyCode", width: 160 },
		{ title: "企业名称", dataIndex: "companyName" },
		{
			title: t("common.status"),
			dataIndex: "status",
			width: 100,
			render: (_, r) => (
				<Tag color={r.status === "ENABLED" ? "success" : "default"}>
					{r.status === "ENABLED" ? t("common.enabled") : t("common.disabled")}
				</Tag>
			),
		},
		{
			title: t("common.action"),
			valueType: "option",
			width: 200,
			fixed: "right",
			render: (_, record) => [
				<Button
					key="edit"
					type="link"
					size="small"
					onClick={() => setEditing(record)}
				>
					{t("common.edit")}
				</Button>,
				<Popconfirm
					key="toggle"
					title={record.status === "ENABLED" ? "确认停用该企业？" : "确认启用该企业？"}
					onConfirm={() => statusMutation.mutate({ companyId: record.companyId, status: record.status === "ENABLED" ? "DISABLED" : "ENABLED" })}
				>
					<Button type="link" size="small" danger={record.status === "ENABLED"}>
						{record.status === "ENABLED" ? t("common.disabled") : t("common.enabled")}
					</Button>
				</Popconfirm>,
				<Popconfirm
					key="delete"
					title="确认删除该企业？"
					description="若有用户归属将拒绝删除"
					onConfirm={() => deleteMutation.mutate(record.companyId)}
				>
					<Button type="link" size="small" danger>
						{t("common.delete")}
					</Button>
				</Popconfirm>,
			],
		},
	];

	return (
		<BasicContent>
			<BasicTable<CompanyResponse>
				actionRef={actionRef}
				rowKey="companyId"
				loading={isLoading}
				dataSource={companies}
				columns={columns}
				search={false}
				toolBarRender={() => [
					<Button key="add" type="primary" onClick={() => setModalOpen(true)}>
						{t("common.add")}
					</Button>,
				]}
			/>
			<ModalForm
				title="新增企业"
				open={modalOpen}
				onOpenChange={setModalOpen}
				modalProps={{ destroyOnHidden: true }}
				onFinish={async (values: CreateCompanyRequest) => {
					await createMutation.mutateAsync(values);
					return true;
				}}
			>
				<ProFormText name="companyCode" label="企业编码" rules={[{ required: true }]} />
				<ProFormText name="companyName" label="企业名称" rules={[{ required: true }]} />
			</ModalForm>
			<ModalForm
				title="编辑企业"
				open={!!editing}
				initialValues={editing ? { companyCode: editing.companyCode, companyName: editing.companyName } : {}}
				modalProps={{ destroyOnHidden: true, onCancel: () => setEditing(null) }}
				onOpenChange={(open) => {
					if (!open)
						setEditing(null);
				}}
				onFinish={async (values: CreateCompanyRequest) => {
					if (editing) {
						await updateMutation.mutateAsync({ companyId: editing.companyId, data: values });
					}
					return true;
				}}
			>
				<ProFormText name="companyCode" label="企业编码" rules={[{ required: true }]} />
				<ProFormText name="companyName" label="企业名称" rules={[{ required: true }]} />
			</ModalForm>
		</BasicContent>
	);
}
