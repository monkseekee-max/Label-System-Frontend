import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImageAnnotationViewer } from "./image-annotation-viewer";

describe("imageAnnotationViewer accessibility", () => {
	it("renders a screen-reader live region announcing annotation state", () => {
		const { container } = render(<ImageAnnotationViewer imageUrl="x.png" />);
		const live = container.querySelector("[aria-live='polite']");
		expect(live).not.toBeNull();
		expect(live?.getAttribute("role")).toBe("status");
	});

	it("defaults to a no-rects announcement when empty", () => {
		render(<ImageAnnotationViewer imageUrl="x.png" />);
		expect(screen.getByText("暂无标注框")).toBeInTheDocument();
	});

	it("associates the label input with an accessible name", () => {
		render(<ImageAnnotationViewer imageUrl="x.png" />);
		const input = screen.getByLabelText("标签");
		expect(input).toBeInTheDocument();
	});
});
