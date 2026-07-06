import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryState } from "./index";

describe("queryState", () => {
	it("shows a loading skeleton when isLoading is true", () => {
		const { container } = render(
			<QueryState isLoading><div>content</div></QueryState>,
		);
		expect(container.querySelector("[role='status']")).not.toBeNull();
		expect(screen.queryByText("content")).not.toBeInTheDocument();
	});

	it("shows an error state with retry when isError is true", () => {
		const onRetry = vi.fn();
		const { container } = render(
			<QueryState isError error={new Error("boom")} onRetry={onRetry}>
				<div>content</div>
			</QueryState>,
		);
		expect(container.querySelector("[role='alert']")).not.toBeNull();
		expect(screen.getByText("boom")).toBeInTheDocument();
		fireEvent.click(screen.getByText(/重\s?试/));
		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("content")).not.toBeInTheDocument();
	});

	it("shows an empty state when isEmpty is true", () => {
		render(<QueryState isEmpty emptyText="暂无数据集"><div>content</div></QueryState>);
		expect(screen.getByText("暂无数据集")).toBeInTheDocument();
		expect(screen.queryByText("content")).not.toBeInTheDocument();
	});

	it("renders children when not loading, error, or empty", () => {
		render(<QueryState><div>real content</div></QueryState>);
		expect(screen.getByText("real content")).toBeInTheDocument();
	});

	it("prioritizes loading over error and empty", () => {
		const { container } = render(
			<QueryState isLoading isError isEmpty><div>content</div></QueryState>,
		);
		expect(container.querySelector("[role='status']")).not.toBeNull();
		expect(container.querySelector("[role='alert']")).toBeNull();
	});
});
