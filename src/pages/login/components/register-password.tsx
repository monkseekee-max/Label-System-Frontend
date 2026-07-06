import type { RegisterInfo } from "#src/api/user";

import { fetchRegister, fetchRegisterCompanies } from "#src/api/user";
import { MOBILE_PHONE_RULES } from "#src/constants/rules";
import { useAuthStore } from "#src/store/auth";

import {
	Button,
	Form,
	Input,
	Select,
	Space,
} from "antd";
import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { FormModeContext } from "../form-mode-context";

const FORM_INITIAL_VALUES = {
	phone: "",
	companyCode: "",
	username: "",
	password: "",
	confirm: "",
};

export type RegisterPasswordFormType = typeof FORM_INITIAL_VALUES;

export function RegisterPassword() {
	const [loading, setLoading] = useState(false);
	const [companyOptions, setCompanyOptions] = useState<Array<{ label: string, value: string }>>([]);
	const [registerForm] = Form.useForm();
	const { t } = useTranslation();
	const { setFormMode } = use(FormModeContext);
	const login = useAuthStore(state => state.login);
	const navigate = useNavigate();

	useEffect(() => {
		fetchRegisterCompanies()
			.then((resp) => {
				const options = resp.result.map(item => ({
					label: item.companyName,
					value: item.companyCode,
				}));
				setCompanyOptions(options);
			})
			.catch(() => {
				window.$message?.warning(t("common.register.companyLoadFailed"));
			});
	}, []);

	const handleFinish = async (values: RegisterInfo & { confirm: string }) => {
		setLoading(true);
		window.$message?.loading(t("common.register.loading"), 0);
		try {
			await fetchRegister({
				phone: values.phone,
				companyCode: values.companyCode,
				username: values.username,
				password: values.password,
				realName: values.username,
			});
			// P2: 注册成功后自动登录, 无需再手动跳登录页
			await login({
				phone: values.phone,
				companyCode: values.companyCode,
				password: values.password,
			});
			window.$message?.destroy();
			window.$message?.success(t("common.register.success"));
			navigate(import.meta.env.VITE_BASE_HOME_PATH);
		}
		catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			window.$message?.destroy();
			window.$message?.error(msg || t("common.register.failed"));
		}
		finally {
			setLoading(false);
		}
	};

	return (
		<>
			<Space orientation="vertical">
				<h2 className="text-colorText mb-1 text-3xl font-bold leading-9 tracking-tight">
					{t("common.register.title")}
				</h2>
				<p className="text-colorTextSecondary lg:text-base text-sm">
					{t("common.register.subtitle")}
				</p>
			</Space>

			<Form
				name="registerForm"
				form={registerForm}
				layout="vertical"
				initialValues={FORM_INITIAL_VALUES}
				onFinish={handleFinish}
			>
				<Form.Item
					label={t("common.register.phone")}
					name="phone"
					rules={MOBILE_PHONE_RULES(t)}
				>
					<Input placeholder={t("common.register.phonePlaceholder")} />
				</Form.Item>

				<Form.Item
					label={t("common.register.company")}
					name="companyCode"
					rules={[{ required: true, message: t("common.register.companyRequired") }]}
				>
					<Select
						placeholder={t("common.register.companyPlaceholder")}
						options={companyOptions}
						notFoundContent={t("common.register.companyNotFound")}
					/>
				</Form.Item>

				<Form.Item
					label={t("common.register.username")}
					name="username"
					rules={[
						{ required: true, message: t("common.register.usernameRequired") },
						{ min: 2, message: t("common.register.usernameMin") },
					]}
				>
					<Input placeholder={t("common.register.usernameRequired")} />
				</Form.Item>

				<Form.Item
					label={t("common.register.password")}
					name="password"
					rules={[
						{ required: true, message: t("common.register.passwordRequired") },
						{ min: 8, message: t("common.register.passwordMin") },
						{
							pattern: /^(?=.*[A-Z])(?=.*\d).{8,}$/i,
							message: t("common.register.passwordPattern"),
						},
					]}
				>
					<Input.Password placeholder={t("common.register.passwordPlaceholder")} />
				</Form.Item>

				<Form.Item
					name="confirm"
					label={t("common.register.confirm")}
					dependencies={["password"]}
					hasFeedback
					rules={[
						{ required: true, message: t("common.register.confirmRequired") },
						({ getFieldValue }) => ({
							validator(_, value) {
								if (!value || getFieldValue("password") === value) {
									return Promise.resolve();
								}
								return Promise.reject(new Error(t("common.register.confirmMismatch")));
							},
						}),
					]}
				>
					<Input.Password placeholder={t("common.register.confirmPlaceholder")} />
				</Form.Item>

				<Form.Item>
					<Button block type="primary" htmlType="submit" loading={loading}>
						{t("common.register.submit")}
					</Button>
				</Form.Item>

				<div className="text-center text-sm text-colorTextSecondary">
					{t("common.register.hasAccount")}
					<Button
						type="link"
						className="px-1"
						onClick={() => setFormMode("login")}
					>
						{t("common.register.toLogin")}
					</Button>
				</div>
			</Form>
		</>
	);
}
