import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./index";

describe("emptyState", () => {
	it("renders the default description when none provided", () => {
		render(<EmptyState />);
		expect(screen.getByText("暂无数据")).toBeInTheDocument();
	});

	it("renders a custom description", () => {
		render(<EmptyState description="暂无训练任务" />);
		expect(screen.getByText("暂无训练任务")).toBeInTheDocument();
		expect(screen.queryByText("暂无数据")).not.toBeInTheDocument();
	});

	it("renders an action passed as children", () => {
		render(<EmptyState><button type="button">新建</button></EmptyState>);
		expect(screen.getByText("新建")).toBeInTheDocument();
	});
});
