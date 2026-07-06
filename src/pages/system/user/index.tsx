import type { BackendUserPosition, BackendUserRole, CompanyUserResponse, CreateUserRequest, UpdateUserAssignmentRequest, UserListParams, UserStatus } from "#src/api/company/users";
import type { DefaultInitialPassword } from "#src/api/iam/default-password";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { createCompanyUser, fetchCompanyUsers, updateUserAssignment, updateUserStatus } from "#src/api/company/users";
import { saveDefaultInitialPassword } from "#src/api/iam/default-password";
import { BasicContent } from "#src/components/basic-content";
import { BasicTable } from "#src/components/basic-table";
import { IAM_PASSWORD_RULES, InitialPasswordField } from "#src/components/initial-password-field";
import { useDefaultInitialPassword } from "#src/hooks/use-default-initial-password";
import { useUserStore } from "#src/store/user";
import { SettingOutlined } from "@ant-design/icons";
import {
	ModalForm,
	ProFormDependency,
	ProFormSelect,
	ProFormSwitch,
	ProFormText,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Input, Popconfirm, Select, Space, Tag } from "antd";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const ROLE_OPTIONS = [
	{ label: "员工", value: "EMPLOYEE" },
	{ label: "部门经理", value: "MANAGER" },
	{ label: "总工程师", value: "ENGINEER" },
];

const POSITION_OPTIONS = [
	{ label: "标注员", value: "ANNOTATOR" },
	{ label: "数据训练师", value: "DATA_TRAINER" },
	{ label: "审核员", value: "REVIEWER" },
	{ label: "公司管理员", value: "ADMIN" },
];

const STATUS_OPTIONS = [
	{ label: "启用", value: "ENABLED" },
	{ label: "禁用", value: "DISABLED" },
];

type ModalMode = "add" | "assignment";

export default function User() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const actionRef = useRef<ActionType>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<ModalMode>("add");
	const [selectedUser, setSelectedUser] = useState<CompanyUserResponse | null>(null);
	const [pwdSettingOpen, setPwdSettingOpen] = useState(false);

	// 统一初始密码配置 (启用后新增用户表单密码框变灰预填, 两处表单共享)
	const { data: defaultPwd } = useDefaultInitialPassword();
	const savePwdMutation = useMutation({
		mutationFn: saveDefaultInitialPassword,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["iam", "default-initial-password"] });
			window.$message?.success("统一初始密码已保存");
		},
	});

	// 搜索条件
	const [searchRealName, setSearchRealName] = useState("");
	const [searchRealNameInput, setSearchRealNameInput] = useState("");
	const [searchPhone, setSearchPhone] = useState("");
	const [searchPhoneInput, setSearchPhoneInput] = useState("");
	const [searchStatus, setSearchStatus] = useState<UserStatus | undefined>();
	const [searchPosition, setSearchPosition] = useState<BackendUserPosition | undefined>();
	const [searchRole, setSearchRole] = useState<BackendUserRole | undefined>();
	const [searchCompanyName, setSearchCompanyName] = useState("");
	const [searchCompanyNameInput, setSearchCompanyNameInput] = useState("");

	const position = useUserStore(s => s.position);
	const isSuperAdmin = position === "SUPER_ADMIN";

	const params: UserListParams | undefined = (() => {
		const p: UserListParams = {};
		if (searchRealName)
			p.realName = searchRealName;
		if (searchPhone)
			p.phone = searchPhone;
		if (searchStatus)
			p.status = searchStatus;
		if (searchPosition)
			p.position = searchPosition;
		if (searchRole)
			p.role = searchRole;
		if (isSuperAdmin && searchCompanyName)
			p.companyName = searchCompanyName;
		return Object.keys(p).length > 0 ? p : undefined;
	})();

	const { data: users, isLoading } = useQuery({
		queryKey: ["company-users", "list", params],
		queryFn: () => fetchCompanyUsers(params).then(r => r.result ?? []),
	});

	const createMutation = useMutation({
		mutationFn: createCompanyUser,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["company-users"] });
			window.$message?.success(t("common.addSuccess"));
		},
	});

	const assignmentMutation = useMutation({
		mutationFn: ({ userId, data }: { userId: string | number, data: { role: CompanyUserResponse["role"], position: CompanyUserResponse["position"] } }) =>
			updateUserAssignment(userId, data),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["company-users"] });
			window.$message?.success(t("common.updateSuccess"));
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ userId, status }: { userId: string | number, status: "ENABLED" | "DISABLED" }) =>
			updateUserStatus(userId, { status }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["company-users"] });
			window.$message?.success(t("common.updateSuccess"));
		},
	});

	const columns: ProColumns<CompanyUserResponse>[] = [
		{ title: t("common.index"), valueType: "index", width: 60 },
		{ title: "用户名", dataIndex: "realName" },
		{ title: "账号邮箱", dataIndex: "email", width: 220 },
		{
			title: "角色",
			dataIndex: "role",
			width: 120,
			render: (_, r) => ROLE_OPTIONS.find(o => o.value === r.role)?.label ?? r.role,
		},
		{
			title: "岗位",
			dataIndex: "position",
			width: 120,
			render: (_, r) => POSITION_OPTIONS.find(o => o.value === r.position)?.label ?? r.position,
		},
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
			width: 180,
			fixed: "right",
			render: (_, record) => [
				<Button
					key="assignment"
					type="link"
					size="small"
					onClick={() => {
						setSelectedUser(record);
						setModalMode("assignment");
						setModalOpen(true);
					}}
				>
					修改岗位
				</Button>,
				<Popconfirm
					key="toggle"
					title={record.status === "ENABLED" ? "确认停用该用户？" : "确认启用该用户？"}
					onConfirm={() => statusMutation.mutate({ userId: record.userId, status: record.status === "ENABLED" ? "DISABLED" : "ENABLED" })}
				>
					<Button type="link" size="small" danger={record.status === "ENABLED"}>
						{record.status === "ENABLED" ? t("common.disabled") : t("common.enabled")}
					</Button>
				</Popconfirm>,
			],
		},
	];

	const handleSearch = () => {
		setSearchRealName(searchRealNameInput);
		setSearchPhone(searchPhoneInput);
		setSearchCompanyName(searchCompanyNameInput);
	};

	const handleReset = () => {
		setSearchRealNameInput("");
		setSearchPhoneInput("");
		setSearchCompanyNameInput("");
		setSearchRealName("");
		setSearchPhone("");
		setSearchCompanyName("");
		setSearchStatus(undefined);
		setSearchPosition(undefined);
		setSearchRole(undefined);
	};

	return (
		<BasicContent>
			<div className="mb-4">
				<Space wrap>
					{isSuperAdmin && (
						<Input
							placeholder="公司名称"
							value={searchCompanyNameInput}
							onChange={e => setSearchCompanyNameInput(e.target.value)}
							style={{ width: 160 }}
							allowClear
							onPressEnter={handleSearch}
						/>
					)}
					<Input
						placeholder="真实姓名"
						value={searchRealNameInput}
						onChange={e => setSearchRealNameInput(e.target.value)}
						className="w-[140px]"
						allowClear
						onPressEnter={handleSearch}
					/>
					<Input
						placeholder="账号邮箱"
						value={searchPhoneInput}
						onChange={e => setSearchPhoneInput(e.target.value)}
						className="w-[180px]"
						allowClear
						onPressEnter={handleSearch}
					/>
					<Select
						placeholder="状态"
						value={searchStatus}
						onChange={v => setSearchStatus(v)}
						options={STATUS_OPTIONS}
						allowClear
						style={{ width: 100 }}
					/>
					<Select
						placeholder="岗位"
						value={searchPosition}
						onChange={v => setSearchPosition(v)}
						options={POSITION_OPTIONS}
						allowClear
						className="w-[140px]"
					/>
					<Select
						placeholder="角色"
						value={searchRole}
						onChange={v => setSearchRole(v)}
						options={ROLE_OPTIONS}
						allowClear
						className="w-[140px]"
					/>
					<Button type="primary" onClick={handleSearch}>{t("common.search")}</Button>
					<Button onClick={handleReset}>{t("common.reset")}</Button>
				</Space>
			</div>

			<BasicTable<CompanyUserResponse>
				actionRef={actionRef}
				rowKey="userId"
				loading={isLoading}
				dataSource={users}
				columns={columns}
				search={false}
				toolBarRender={() => [
					isSuperAdmin && defaultPwd?.enabled
						? (
							<Tag key="pwd-state" color="success" style={{ marginInlineEnd: 0 }}>
								已启用统一初始密码
							</Tag>
						)
						: null,
					isSuperAdmin
						? (
							<Button
								key="pwd-setting"
								icon={<SettingOutlined />}
								onClick={() => setPwdSettingOpen(true)}
							>
								统一初始密码
							</Button>
						)
						: null,
					<Button
						key="add"
						type="primary"
						onClick={() => {
							setSelectedUser(null);
							setModalMode("add");
							setModalOpen(true);
						}}
					>
						{t("common.add")}
					</Button>,
				]}
			/>

			<ModalForm
				title={modalMode === "add" ? "新增用户" : "修改岗位"}
				open={modalOpen}
				onOpenChange={setModalOpen}
				modalProps={{ destroyOnHidden: true }}
				initialValues={selectedUser ?? undefined}
				onFinish={async (values: Omit<CreateUserRequest, "createType"> & UpdateUserAssignmentRequest) => {
					if (modalMode === "add") {
						const payload: CreateUserRequest = {
							createType: "COMPANY_USER",
							phone: values.phone,
							password: values.password,
							username: values.username,
							realName: values.username,
							role: values.role,
							position: values.position,
						};
						await createMutation.mutateAsync(payload);
					}
					else if (selectedUser) {
						await assignmentMutation.mutateAsync({ userId: selectedUser.userId, data: values as UpdateUserAssignmentRequest });
					}
					return true;
				}}
			>
				{modalMode === "add" && (
					<>
						<ProFormText name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]} />
						<InitialPasswordField />
						<ProFormText name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]} />
					</>
				)}
				<ProFormSelect name="role" label="角色" options={ROLE_OPTIONS} rules={[{ required: true }]} />
				<ProFormSelect name="position" label="岗位" options={POSITION_OPTIONS} rules={[{ required: true }]} />
			</ModalForm>

			{/* 统一初始密码设置: 启用后两处新增用户表单密码框变灰预填, 免去每次手填 */}
			<ModalForm
				title="统一初始密码设置"
				width={480}
				open={pwdSettingOpen}
				onOpenChange={setPwdSettingOpen}
				modalProps={{ destroyOnHidden: true }}
				initialValues={{ enabled: defaultPwd?.enabled ?? false, password: defaultPwd?.password ?? "" }}
				onFinish={async (values: DefaultInitialPassword & { confirm?: string }) => {
					await savePwdMutation.mutateAsync({ enabled: values.enabled, password: values.password ?? "" });
					return true;
				}}
			>
				<Alert
					type="info"
					showIcon
					message="启用后，新增用户表单的「初始密码」将自动填入此密码并置灰不可修改"
					description="适用于演示或统一发放账号场景；关闭后恢复每次手动输入。"
					style={{ marginBottom: 16 }}
				/>
				<ProFormSwitch name="enabled" label="启用统一初始密码" />
				<ProFormDependency name={["enabled"]}>
					{({ enabled }) => enabled
						? (
							<>
								<ProFormText.Password
									name="password"
									label="统一初始密码"
									rules={IAM_PASSWORD_RULES}
									placeholder="至少8位，需含大小写字母、数字和特殊字符"
								/>
								<ProFormText.Password
									name="confirm"
									label="确认密码"
									rules={[
										{ required: true, message: "请确认密码" },
										({ getFieldValue }) => ({
											validator(_, value) {
												if (!value || getFieldValue("password") === value)
													return Promise.resolve();
												return Promise.reject(new Error("两次输入的密码不一致"));
											},
										}),
									]}
								/>
							</>
						)
						: null}
				</ProFormDependency>
			</ModalForm>
		</BasicContent>
	);
}
