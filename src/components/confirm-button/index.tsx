import type { ButtonProps } from "antd";
import type { ReactNode } from "react";
import { Button, Popconfirm } from "antd";

interface ConfirmButtonProps extends Omit<ButtonProps, "onClick" | "title"> {
	onConfirm: () => void
	title?: ReactNode
	description?: ReactNode
	okText?: string
	cancelText?: string
	placement?: React.ComponentProps<typeof Popconfirm>["placement"]
	children: ReactNode
}

export function ConfirmButton({
	onConfirm,
	title = "确认执行此操作吗？",
	description,
	okText,
	cancelText,
	placement = "top",
	children,
	...buttonProps
}: ConfirmButtonProps) {
	return (
		<Popconfirm
			title={title}
			description={description}
			onConfirm={onConfirm}
			okText={okText}
			cancelText={cancelText}
			placement={placement}
		>
			<Button {...buttonProps}>{children}</Button>
		</Popconfirm>
	);
}
