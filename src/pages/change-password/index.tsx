import type { ChangePasswordRequest } from "#src/api/user";

import { changePassword } from "#src/api/user";
import Banner from "#src/assets/svg/banner.svg?react";
import logo from "#src/assets/svg/logo.svg?url";
import { usePreferences } from "#src/hooks/use-preferences";
import LayoutFooter from "#src/layout/layout-footer";
import { LanguageButton } from "#src/layout/layout-header/components/language-button";
import { ThemeButton } from "#src/layout/layout-header/components/theme-button";
import { useUserStore } from "#src/store/user";
import { goLogin } from "#src/utils/request/go-login";

import { Button, Col, Form, Grid, Input, Row, Space, theme, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function ChangePassword() {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const [form] = Form.useForm<ChangePasswordRequest & { confirmPassword: string }>();
	const { isDark } = usePreferences();
	const { token } = theme.useToken();
	const screens = Grid.useBreakpoint();
	const setMustChangePassword = useUserStore(state => state.setMustChangePassword);

	const handleFinish = async (values: ChangePasswordRequest) => {
		setLoading(true);
		try {
			await changePassword(values);
			window.$message?.success(t("common.changePassword.success"));
			setMustChangePassword(false);
			// 后端修改密码后会使当前 token 失效，直接跳登录页重新认证
			goLogin();
		}
		catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			window.$message?.error(msg ?? t("common.changePassword.failed"));
		}
		finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ backgroundColor: token.colorBgContainer }}>
			<header className="z-10 absolute flex items-center right-3 top-3 left-3">
				<div className="text-colorText flex flex-1 items-center">
					<img alt="App Logo" src={logo} className="mr-2 w-11" />
					<h1 className="m-0 text-xl font-medium">
						{import.meta.env.VITE_GLOB_APP_TITLE}
					</h1>
				</div>
				<div className="flex items-center">
					<ThemeButton size="large" />
					<LanguageButton size="large" className="px-2.75" />
				</div>
			</header>

			<div className="flex items-center overflow-hidden h-full">
				<Row className="h-screen w-full">
					<Col
						xs={0}
						sm={0}
						lg={15}
						style={{
							backgroundImage: `radial-gradient(${token.colorBgContainer}, ${isDark ? token.colorBgBlur : token.colorPrimaryBg})`,
						}}
					>
						<div className="flex flex-col items-center justify-center h-full gap-3">
							<Banner className="h-64 motion-safe:animate-bounce-in-down-out-up" />
						</div>
					</Col>

					<Col
						xs={24}
						sm={24}
						lg={9}
						className="relative flex flex-col justify-center px-6 py-10 xl:px-8"
						style={(!screens.xl && !screens.xxl && !screens.lg)
							? { backgroundImage: `radial-gradient(${token.colorBgContainer}, ${token.colorPrimaryBg})` }
							: {}}
					>
						<LayoutFooter className="w-full absolute bottom-3 left-1/2 -translate-x-1/2" />
						<div className="w-full sm:mx-auto md:max-w-md">
							<Space orientation="vertical" className="mb-6">
								<Typography.Title level={3} className="mb-1">
									{t("common.changePassword.title")}
								</Typography.Title>
								<Typography.Text type="secondary">
									{t("common.changePassword.subtitle")}
								</Typography.Text>
							</Space>

							<Form form={form} layout="vertical" onFinish={handleFinish}>
								<Form.Item
									label={t("common.changePassword.oldPassword")}
									name="oldPassword"
									rules={[{ required: true, message: t("common.changePassword.oldPasswordPlaceholder") }]}
								>
									<Input.Password placeholder={t("common.changePassword.oldPasswordPlaceholder")} />
								</Form.Item>

								<Form.Item
									label={t("common.changePassword.newPassword")}
									name="newPassword"
									rules={[
										{ required: true, message: t("common.changePassword.newPasswordPlaceholder") },
										{ min: 6, message: t("common.changePassword.minLength") },
									]}
								>
									<Input.Password placeholder={t("common.changePassword.newPasswordPlaceholder")} />
								</Form.Item>

								<Form.Item
									label={t("common.changePassword.confirmPassword")}
									name="confirmPassword"
									dependencies={["newPassword"]}
									rules={[
										{ required: true, message: t("common.changePassword.confirmPasswordPlaceholder") },
										({ getFieldValue }) => ({
											validator(_, value) {
												if (!value || getFieldValue("newPassword") === value) {
													return Promise.resolve();
												}
												return Promise.reject(new Error(t("common.changePassword.mismatch")));
											},
										}),
									]}
								>
									<Input.Password placeholder={t("common.changePassword.confirmPasswordPlaceholder")} />
								</Form.Item>

								<Form.Item className="mt-6">
									<Button block type="primary" htmlType="submit" loading={loading}>
										{t("common.changePassword.submit")}
									</Button>
								</Form.Item>
							</Form>
						</div>
					</Col>
				</Row>
			</div>
		</div>
	);
}
