import type { LoginInfo } from "#src/api/user";

import { fetchLoginCompanies } from "#src/api/user";
import { MOBILE_PHONE_RULES } from "#src/constants/rules";
import { useAuthStore } from "#src/store/auth";

import {
	Button,
	Form,
	Input,
	Select,
	Space,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

const FORM_INITIAL_VALUES: LoginInfo = {
	phone: "",
	companyCode: "",
	password: "",
};

export function PasswordLogin() {
	const [queryingCompanies, setQueryingCompanies] = useState(false);
	const [loading, setLoading] = useState(false);
	const [superAdminMode, setSuperAdminMode] = useState(false);
	const [passwordLoginForm] = Form.useForm();
	const phone = Form.useWatch("phone", passwordLoginForm);
	const selectedCompanyCode = Form.useWatch("companyCode", passwordLoginForm);
	const { t } = useTranslation();
	const commonErrorText = t("common.error");
	const noCompanyFoundText = t("authority.noCompanyFound");
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const login = useAuthStore(state => state.login);
	const [companyOptions, setCompanyOptions] = useState<Array<{ label: string, value: string }>>([]);
	const latestCompanyQueryRef = useRef(0);
	const lastObservedPhoneRef = useRef("");
	const lastQueriedPhoneRef = useRef("");

	useEffect(() => {
		const currentPhone = phone?.trim() ?? "";
		const currentCompanyCode = passwordLoginForm.getFieldValue("companyCode");

		if (!currentPhone) {
			latestCompanyQueryRef.current += 1;
			lastObservedPhoneRef.current = "";
			lastQueriedPhoneRef.current = "";
			// eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
			setCompanyOptions(previousOptions => previousOptions.length ? [] : previousOptions);
			if (currentCompanyCode) {
				passwordLoginForm.setFieldValue("companyCode", undefined);
			}
			// eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
			setQueryingCompanies(false);
			return;
		}

		if (currentPhone !== lastObservedPhoneRef.current) {
			lastObservedPhoneRef.current = currentPhone;
			lastQueriedPhoneRef.current = "";
		}

		if (currentPhone === lastQueriedPhoneRef.current) {
			return;
		}

		latestCompanyQueryRef.current += 1;
		const requestId = latestCompanyQueryRef.current;

		// eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
		setCompanyOptions(previousOptions => previousOptions.length ? [] : previousOptions);
		if (currentCompanyCode) {
			passwordLoginForm.setFieldValue("companyCode", undefined);
		}

		const queryCompanies = async () => {
			try {
				await passwordLoginForm.validateFields(["phone"]);
				if (requestId !== latestCompanyQueryRef.current || passwordLoginForm.getFieldValue("phone")?.trim() !== currentPhone) {
					return;
				}

				setQueryingCompanies(true);
				const response = await fetchLoginCompanies({ phone: currentPhone });
				if (requestId !== latestCompanyQueryRef.current || passwordLoginForm.getFieldValue("phone")?.trim() !== currentPhone) {
					return;
				}

				lastQueriedPhoneRef.current = currentPhone;
				const options = response.result.map(item => ({
					label: item.companyName,
					value: item.companyCode,
				}));
				setCompanyOptions(options);

				if (!options.length) {
					passwordLoginForm.setFieldValue("companyCode", undefined);
					window.$message?.warning(noCompanyFoundText);
					return;
				}

				const selectedCompany = passwordLoginForm.getFieldValue("companyCode");
				if (!options.some(item => item.value === selectedCompany)) {
					passwordLoginForm.setFieldValue("companyCode", options[0].value);
				}
			}
			catch (error: unknown) {
				// 表单校验异常（如手机号不合法）交由 Form.Item 展示提示
				const formErr = error as { errorFields?: unknown, message?: string };
				if (!Array.isArray(formErr?.errorFields) && requestId === latestCompanyQueryRef.current) {
					window.$message?.error(formErr?.message ?? commonErrorText);
				}
			}
			finally {
				if (requestId === latestCompanyQueryRef.current) {
					setQueryingCompanies(false);
				}
			}
		};

		void queryCompanies();
	}, [commonErrorText, noCompanyFoundText, passwordLoginForm, phone]);

	const handleFinish = async (values: LoginInfo) => {
		setLoading(true);
		window.$message?.loading(t("authority.loginInProgress"), 0);

		login(values).then((response) => {
			window.$message?.destroy();
			window.$message?.success(t("authority.loginSuccess"));
			const redirect = searchParams.get("redirect");
			const isSuperAdmin = response?.result?.position === "SUPER_ADMIN";
			const isPlatformLogin = superAdminMode || !values.companyCode;

			if (redirect) {
				navigate(`/${redirect.slice(1)}`);
			}
			else if (isSuperAdmin && isPlatformLogin) {
				navigate("/platform/companies");
			}
			else {
				navigate(import.meta.env.VITE_BASE_HOME_PATH);
			}
		}).catch((error: Error) => {
			window.$notification?.warning({ message: error?.message || commonErrorText });
		}).finally(() => {
			window.$message?.destroy();
			setTimeout(() => {
				window.$message?.destroy();
				setLoading(false);
			}, 1000);
		});
	};

	return (
		<>
			<Space orientation="vertical">
				<h2 className="text-colorText mb-3 text-3xl font-bold leading-9 tracking-tight lg:text-4xl">
					{t("authority.mobileLogin")}
				</h2>
				<p className="lg:text-base text-sm text-colorTextSecondary">
					{t("authority.loginDescription")}
				</p>
			</Space>

			<Form
				name="passwordLoginForm"
				form={passwordLoginForm}
				layout="vertical"
				initialValues={FORM_INITIAL_VALUES}
				onFinish={handleFinish}
			>
				<Form.Item
					label={t("authority.mobile")}
					name="phone"
					rules={MOBILE_PHONE_RULES(t)}
				>
					<Input placeholder={t("form.mobile.required")} />
				</Form.Item>

				{!superAdminMode && (
					<Form.Item
						label={t("authority.company")}
						name="companyCode"
						rules={[
							{
								required: true,
								message: t("form.company.required"),
							},
						]}
					>
						<Select
							placeholder={queryingCompanies ? `${t("authority.company")}...` : t("authority.company")}
							options={companyOptions}
							loading={queryingCompanies}
							disabled={!companyOptions.length}
						/>
					</Form.Item>
				)}

				<Form.Item
					label={t("authority.password")}
					name="password"
					rules={[{ required: true, message: t("form.password.required") }, { min: 6, message: "密码长度至少 6 位" }]}
				>
					<Input.Password placeholder={t("form.password.required")} disabled={!superAdminMode && !selectedCompanyCode} />
				</Form.Item>

				<Form.Item>
					<Button block type="primary" htmlType="submit" loading={loading}>
						{t("authority.login")}
					</Button>
				</Form.Item>

				<div style={{ textAlign: "center" }}>
					<Button
						type="link"
						size="small"
						onClick={() => {
							setSuperAdminMode(!superAdminMode);
							passwordLoginForm.setFieldValue("companyCode", undefined);
						}}
					>
						{superAdminMode ? "← 企业用户登录" : "超管直接登录 →"}
					</Button>
				</div>
			</Form>
		</>
	);
}
