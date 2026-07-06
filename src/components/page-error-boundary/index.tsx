import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface PageErrorBoundaryProps {
	children: ReactNode
	fallback?: (error: Error, reset: () => void) => ReactNode
	onError?: (error: Error, info: ErrorInfo) => void
}

interface PageErrorBoundaryState {
	error: Error | null
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
	state: PageErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		this.props.onError?.(error, info);
	}

	reset = (): void => {
		this.setState({ error: null });
	};

	render(): ReactNode {
		const { error } = this.state;
		const { children, fallback } = this.props;

		if (error) {
			if (fallback) {
				return fallback(error, this.reset);
			}
			return null;
		}
		return children;
	}
}
