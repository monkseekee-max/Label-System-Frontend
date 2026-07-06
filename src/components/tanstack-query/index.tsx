import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function getErrorStatus(error: unknown) {
	if (typeof error !== "object" || error === null || !("status" in error)) {
		return undefined;
	}
	const status = (error as { status?: unknown }).status;
	return typeof status === "number" ? status : undefined;
}

function isRetryable(error: unknown, attempt: number) {
	const status = getErrorStatus(error);
	return attempt < 2 && status != null && RETRYABLE_STATUS.has(status);
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60_000,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: (count, error) => isRetryable(error, count),
			retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
		},
		mutations: {
			retry: 0,
		},
	},
});

export interface TanstackQueryProps {
	children: ReactNode
}

export function TanstackQuery({ children }: TanstackQueryProps) {
	return (
		<QueryClientProvider client={queryClient}>
			{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
			{children}
		</QueryClientProvider>
	);
}
