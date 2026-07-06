import type { ReactNode } from "react";
import { EmptyState } from "#src/components/empty-state";
import { ErrorState } from "#src/components/error-state";
import { PageSkeleton } from "#src/components/page-skeleton";

interface QueryStateProps {
	isLoading?: boolean
	isError?: boolean
	isEmpty?: boolean
	error?: unknown
	onRetry?: () => void
	emptyText?: ReactNode
	skeletonRows?: number
	children?: ReactNode
}

export function QueryState({
	isLoading,
	isError,
	isEmpty,
	error,
	onRetry,
	emptyText,
	skeletonRows,
	children,
}: QueryStateProps) {
	if (isLoading) {
		return <PageSkeleton rows={skeletonRows} />;
	}
	if (isError) {
		return <ErrorState error={error} onRetry={onRetry} />;
	}
	if (isEmpty) {
		return <EmptyState description={emptyText} />;
	}
	return <>{children}</>;
}
