import { Alert, Button } from "antd";

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "真实后端接口调用失败";
}

interface QueryErrorAlertProps {
	error: unknown
	onRetry?: () => void
	title?: string
}

export function QueryErrorAlert({ error, onRetry, title = "真实后端不可用" }: QueryErrorAlertProps) {
	return (
		<Alert
			type="error"
			showIcon
			className="mb-4"
			message={title}
			description={getErrorMessage(error)}
			action={onRetry
				? (
					<Button size="small" danger onClick={onRetry}>
						重试
					</Button>
				)
				: undefined}
		/>
	);
}
