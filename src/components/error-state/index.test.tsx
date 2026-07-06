import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "./index";

describe("errorState", () => {
	it("renders the default title and acts as an alert region", () => {
		const { container } = render(<ErrorState />);
		expect(screen.getByText("加载失败")).toBeInTheDocument();
		expect(container.querySelector("[role='alert']")).not.toBeNull();
	});

	it("does not render a retry button when onRetry is absent", () => {
		render(<ErrorState />);
		expect(screen.queryByText(/重\s?试/)).not.toBeInTheDocument();
	});

	it("renders a retry button that calls onRetry when clicked", () => {
		const onRetry = vi.fn();
		render(<ErrorState onRetry={onRetry} />);
		const retryButton = screen.getByText(/重\s?试/);
		fireEvent.click(retryButton);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("surfaces an Error message as the subtitle when provided", () => {
		render(<ErrorState error={new Error("网络断开")} />);
		expect(screen.getByText("网络断开")).toBeInTheDocument();
	});
});
