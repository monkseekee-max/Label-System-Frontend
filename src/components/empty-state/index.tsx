import type { ReactNode } from "react";
import { Empty } from "antd";

interface EmptyStateProps {
	description?: ReactNode
	image?: ReactNode
	children?: ReactNode
}

export function EmptyState({ description = "暂无数据", image, children }: EmptyStateProps) {
	return (
		<Empty image={image} description={description}>
			{children}
		</Empty>
	);
}
