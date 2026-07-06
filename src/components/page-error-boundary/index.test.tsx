import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PageErrorBoundary } from "./index";

function ThrowOnRender({ message }: { message: string }): never {
	throw new Error(message);
}

describe("pageErrorBoundary", () => {
	it("renders children when no error", () => {
		render(
			<PageErrorBoundary>
				<div>healthy child</div>
			</PageErrorBoundary>,
		);
		expect(screen.getByText("healthy child")).toBeInTheDocument();
	});

	it("calls the onError handler when a child throws", () => {
		const onError = vi.fn();
		render(
			<PageErrorBoundary onError={onError}>
				<ThrowOnRender message="kaboom" />
			</PageErrorBoundary>,
		);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0]?.[0]?.message).toBe("kaboom");
	});

	it("renders a custom fallback with the error and a reset action", () => {
		function Fallback({ error, reset }: { error: Error, reset: () => void }) {
			return (
				<div>
					<span>{error.message}</span>
					<button type="button" onClick={reset}>reset</button>
				</div>
			);
		}
		render(
			<PageErrorBoundary fallback={(e, reset) => <Fallback error={e} reset={reset} />}>
				<ThrowOnRender message="crashed" />
			</PageErrorBoundary>,
		);
		expect(screen.getByText("crashed")).toBeInTheDocument();
		expect(screen.getByText("reset")).toBeInTheDocument();
	});

	it("recovers when reset clears the error and the child no longer throws", () => {
		let shouldThrow = true;
		function MaybeThrow() {
			if (shouldThrow) {
				throw new Error("boom");
			}
			return <div>recovered child</div>;
		}
		render(
			<PageErrorBoundary fallback={(_e, reset) => <button type="button" onClick={reset}>reset</button>}>
				<MaybeThrow />
			</PageErrorBoundary>,
		);
		expect(screen.getByText("reset")).toBeInTheDocument();
		expect(screen.queryByText("recovered child")).not.toBeInTheDocument();

		shouldThrow = false;
		fireEvent.click(screen.getByText("reset"));
		expect(screen.getByText("recovered child")).toBeInTheDocument();
		expect(screen.queryByText("reset")).not.toBeInTheDocument();
	});
});
