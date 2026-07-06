import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageSkeleton } from "./index";

describe("pageSkeleton", () => {
	it("renders with status/live-region semantics for screen readers", () => {
		const { container } = render(<PageSkeleton />);
		const status = container.querySelector("[role='status']");
		expect(status).not.toBeNull();
		expect(status?.getAttribute("aria-live")).toBe("polite");
	});

	it("exposes an accessible loading label", () => {
		const { container } = render(<PageSkeleton />);
		expect(container.querySelector("[aria-label='加载中']")).not.toBeNull();
	});

	it("accepts a rows override without crashing", () => {
		const { container } = render(<PageSkeleton rows={8} />);
		expect(container.querySelector("[role='status']")).not.toBeNull();
	});
});
