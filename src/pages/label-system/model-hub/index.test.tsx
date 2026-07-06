import type { TrainedModel } from "#src/api/label-system";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	fetchTrainedModels: vi.fn<() => Promise<{ items: TrainedModel[] }>>(),
}));

vi.mock("#src/api/label-system", async () => {
	const actual = await vi.importActual<typeof import("#src/api/label-system")>("#src/api/label-system");
	return {
		...actual,
		fetchTrainedModels: mocks.fetchTrainedModels,
		deployModel: vi.fn(),
	};
});

vi.mock("#src/pages/llm-factory/_shared/theme", () => ({
	useLlmTokens: () => ({
		colorPrimary: "#1677ff",
		colorPrimaryBg: "#e6f4ff",
		colorSuccess: "#52c41a",
		colorWarning: "#faad14",
	}),
}));

import ModelHub from "./index";

const trainedModel: TrainedModel = {
	id: "model-1",
	artifact_id: "artifact-1",
	name: "智能标注-LoRA-v1",
	base_model: "qwen3-8b",
	status: "ready",
	metrics: { accuracy: 0.91 },
	created_at: "2026-06-20T00:00:00Z",
} as TrainedModel;

function renderWithProviders() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<AntdApp>
				<MemoryRouter><ModelHub /></MemoryRouter>
			</AntdApp>
		</QueryClientProvider>,
	);
}

describe("modelHub page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchTrainedModels.mockResolvedValue({ items: [trainedModel] });
	});

	it("renders model center summary", async () => {
		renderWithProviders();
		expect(screen.getByRole("heading", { name: /模型/ })).toBeInTheDocument();
		await waitFor(() => expect(screen.getByText("智能标注-LoRA-v1")).toBeInTheDocument(), { timeout: 2000 });
	});
});
