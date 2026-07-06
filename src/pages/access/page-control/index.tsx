import type { LoginInfo } from "#src/api/user";

import { BasicContent } from "#src/components/basic-content";
import { AccessControlRoles } from "#src/hooks/use-access";
import { useAuthStore } from "#src/store/auth";
import { useUserStore } from "#src/store/user";
import { Alert, Button, Card, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

const accounts: Record<string, LoginInfo> = {
	[AccessControlRoles.admin]: {
		phone: "13800000000",
		companyCode: "alpha",
		password: "abc12345",
	},
	[AccessControlRoles.common]: {
		phone: "13900000000",
		companyCode: "beta",
		password: "abc12345",
	},
};

export default function PageControl() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { roles: userRoles } = useUserStore();
	const resetAllStores = useAuthStore(state => state.reset);
	const authLogin = useAuthStore(state => state.login);

	function roleButtonType(role: string) {
		return userRoles.includes(role) ? "primary" : "default";
	}

	function changeAccount(role: string) {
		if (userRoles.includes(role)) {
			return;
		}

		const account = accounts[role];
		resetAllStores();
		if (account) {
			authLogin(account).then(() => {
				navigate(0);
			});
		}
	}

	return (
		<BasicContent className="flex flex-col gap-4">
			<Alert type="info" title={t("access.pageControl.alertMessage")} description={t("access.pageControl.alertDescription")}></Alert>
			<Card title={t("access.pageControl.cardTitle")}>
				<div className="flex items-center gap-4">
					{t("access.pageControl.currentPermissionMode")}
					<Typography.Text code>{t("access.pageControl.frontendControl")}</Typography.Text>
				</div>
			</Card>
			<Card title={t("access.pageControl.accountSwitching")}>
				<div className="flex gap-4">
					<Button type={roleButtonType(AccessControlRoles.admin)} onClick={() => changeAccount(AccessControlRoles.admin)}>
						{t("access.pageControl.switchAdmin")}
					</Button>
					<Button type={roleButtonType(AccessControlRoles.common)} onClick={() => changeAccount(AccessControlRoles.common)}>
						{t("access.pageControl.switchCommon")}
					</Button>
				</div>
			</Card>
		</BasicContent>
	);
}
