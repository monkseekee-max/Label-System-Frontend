import type { CreateCompanyAdminRequest, CreateSystemAdminRequest, UserResponse } from "#src/api/platform/company-admins";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { fetchCompanyList } from "#src/api/platform/companies";
import { createCompanyAdmin, createSystemAdmin, fetchAllCompanyAdmins, updateAdminStatus } from "#src/api/platform/company-admins";
import { BasicContent } from "#src/components/basic-content";
import { BasicTable } from "#src/components/basic-table";
import { InitialPasswordField } from "#src/components/initial-password-field";
import {
	ModalForm,
	ProFormSelect,
	ProFormText,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Tag } from "antd";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type ModalMode = "admin" | "systemAdmin";

export default function CompanyAdmins() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const actionRef = useRef<ActionType>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<ModalMode>("admin");

	const { data: admins, isLoading } = useQuery({
		queryKey: ["platform-company-admins", "list"],
		queryFn: () => fetchAllCompanyAdmins().then(r => r.result ?? []),
	});

	const { data: companies } = useQuery({
		queryKey: ["platform-companies", "list"],
		queryFn: () => fetchCompanyList().then(r => r.result ?? []),
	});

	const createAdminMutation = useMutation({
		mutationFn: createCompanyAdmin,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["platform-company-admins"] });
			window.$message?.success(t("common.addSuccess"));
		},
	});

	const createSystemAdminMutation = useMutation({
		mutationFn: createSystemAdmin,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["platform-company-admins"] });
			window.$message?.success(t("common.addSuccess"));
		},
	});

	const statusMutation = useMutation({
		mutationFn: ({ userId, status }: { userId: string | number, status: "ENABLED" | "DISABLED" }) =>
			updateAdminStatus(userId, { status }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["platform-company-admins"] });
			window.$message?.success(t("common.updateSuccess"));
		},
	});

	const companyOptions = (companies ?? []).map(c => ({ label: c.companyName, value: c.companyId }));
	const adminRoleOptions = [
		{ label: "总工程师", value: "ENGINEER" },
		{ label: "部门经理", value: "MANAGER" },
	];

	const columns: ProColumns<UserResponse>[] = [
		{ title: t("common.index"), valueType: "index", width: 60 },
		{ title: "用户名", dataIndex: "realName" },
		{ title: "账号邮箱", dataIndex: "email", width: 220 },
		{
			title: "所属企业",
			dataIndex: "companyId",
			width: 160,
			render: (_, r) => companies?.find(c => c.companyId === r.companyId)?.companyName ?? r.companyId,
		},
		{ title: "岗位", dataIndex: "position", width: 120 },
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
			width: 120,
			fixed: "right",
			render: (_, record) => [
				<Popconfirm
					key="toggle"
					title={record.status === "ENABLED" ? "确认停用？" : "确认启用？"}
					onConfirm={() => statusMutation.mutate({ userId: record.userId, status: record.status === "ENABLED" ? "DISABLED" : "ENABLED" })}
				>
					<Button type="link" size="small" danger={record.status === "ENABLED"}>
						{record.status === "ENABLED" ? t("common.disabled") : t("common.enabled")}
					</Button>
				</Popconfirm>,
			],
		},
	];

	return (
		<BasicContent>
			<BasicTable<UserResponse>
				actionRef={actionRef}
				rowKey="userId"
				loading={isLoading}
				dataSource={admins}
				columns={columns}
				search={false}
				toolBarRender={() => [
					<Space key="btns">
						<Button
							type="primary"
							onClick={() => {
								setModalMode("admin");
								setModalOpen(true);
							}}
						>
							新增企业管理员
						</Button>
						<Button
							onClick={() => {
								setModalMode("systemAdmin");
								setModalOpen(true);
							}}
						>
							新增系统管理员
						</Button>
					</Space>,
				]}
			/>
			<ModalForm
				title={modalMode === "admin" ? "新增企业管理员" : "新增系统管理员"}
				open={modalOpen}
				onOpenChange={setModalOpen}
				modalProps={{ destroyOnHidden: true }}
				onFinish={async (values: CreateCompanyAdminRequest & CreateSystemAdminRequest) => {
					if (modalMode === "admin") {
						await createAdminMutation.mutateAsync(values as CreateCompanyAdminRequest);
					}
					else {
						await createSystemAdminMutation.mutateAsync(values as CreateSystemAdminRequest);
					}
					return true;
				}}
			>
				{modalMode === "admin" && (
					<>
						<ProFormSelect name="companyId" label="所属企业" options={companyOptions} rules={[{ required: true }]} />
						<ProFormSelect name="role" label="角色" options={adminRoleOptions} rules={[{ required: true }]} />
					</>
				)}
				<ProFormText name="email" label="账号邮箱" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]} />
				<InitialPasswordField />
				<ProFormText name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]} />
			</ModalForm>
		</BasicContent>
	);
}
