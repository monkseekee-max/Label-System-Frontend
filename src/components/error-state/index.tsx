import type { ReactNode } from "react";
import { Button, Result } from "antd";

interface ErrorStateProps {
	title?: ReactNode
	subTitle?: ReactNode
	error?: unknown
	onRetry?: () => void
	retryText?: string
}

export function ErrorState({
	title = "加载失败",
	subTitle,
	error,
	onRetry,
	retryText = "重试",
}: ErrorStateProps) {
	const detail = typeof error === "string"
		? error
		: error instanceof Error
			? error.message
			: undefined;

	return (
		<Result
			status="error"
			title={title}
			subTitle={subTitle ?? detail}
			extra={onRetry ? <Button type="primary" onClick={onRetry}>{retryText}</Button> : undefined}
			role="alert"
		/>
	);
}
