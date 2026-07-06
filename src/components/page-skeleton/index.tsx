import { Skeleton } from "antd";

interface PageSkeletonProps {
	rows?: number
	className?: string
}

export function PageSkeleton({ rows = 5, className }: PageSkeletonProps) {
	return (
		<div
			className={className}
			role="status"
			aria-live="polite"
			aria-label="加载中"
		>
			<Skeleton active paragraph={{ rows }} />
		</div>
	);
}
