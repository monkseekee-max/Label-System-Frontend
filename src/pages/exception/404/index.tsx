import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export default function Exception404() {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const goHome = () => {
		const homePath = import.meta.env.VITE_BASE_HOME_PATH;
		navigate(homePath, { replace: true, flushSync: true });
		setTimeout(() => {
			if (window.location.pathname !== homePath) {
				window.location.assign(homePath);
			}
		}, 0);
	};

	const Result404 = (
		<Result
			status="404"
			title="404"
			subTitle={t("exception.404SubTitle")}
			extra={(
				<Button
					icon={<ArrowLeftOutlined />}
					type="primary"
					onClick={goHome}
				>
					{t("common.backHome")}
				</Button>
			)}
		/>
	);

	return Result404;
}
