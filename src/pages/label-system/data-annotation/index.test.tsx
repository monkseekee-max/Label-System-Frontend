/**
 * data-annotation 数据流组件测试 (合并三标注页后的安全网).
 *
 * 锁住核心数据流: 资产加载 → 自动选中 → QA 列表 → 生成评估 mutation.
 * 图片框选/视频抽帧等 canvas 交互不在单测范围.
 */
import type { DataAsset, QAItem, QARunResponse } from "#src/api/label-system";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DataAnnotation from "./index";

// —— mock label-system API (控制数据流) ——
const mockFetchAssets = vi.fn();
const mockListQAByAsset = vi.fn();
const mockFetchQAItem = vi.fn();
const mockGenerateQA = vi.fn();
const mockFetchAssetRaw = vi.fn();

vi.mock("#src/api/label-system", async () => {
	const actual = await vi.importActual<typeof import("#src/api/label-system")>("#src/api/label-system");
	return {
		...actual,
		fetchAssets: (...a: unknown[]) => mockFetchAssets(...a),
		listQAByAsset: (...a: unknown[]) => mockListQAByAsset(...a),
		fetchQAItem: (...a: unknown[]) => mockFetchQAItem(...a),
		generateQA: (...a: unknown[]) => mockGenerateQA(...a),
		fetchAssetRaw: (...a: unknown[]) => mockFetchAssetRaw(...a),
		analyzeRegion: vi.fn(),
		analyzeVideoFrame: vi.fn(),
		analyzeVideoWindow: vi.fn(),
		updateQAItem: vi.fn(),
		submitQAItem: vi.fn(),
		reviewQAItemWorkflow: vi.fn(),
		finalizeDetailQA: vi.fn(),
		finalizeDetailAnalysis: vi.fn(),
		uploadAsset: vi.fn(),
		qaItemWorkflowHistory: vi.fn(),
	};
});

// —— mock useLlmTokens: 返回组件用到的全部颜色 token ——
vi.mock("#src/pages/llm-factory/_shared/theme", () => ({
	useLlmTokens: () => ({
		colorBgContainer: "#fff",
		colorBorderSecondary: "#eee",
		colorError: "#f00",
		colorFillQuaternary: "#f5f5f5",
		colorInfo: "#1677ff",
		colorPrimary: "#1677ff",
		colorPrimaryBg: "#e6f4ff",
		colorSuccess: "#0f0",
		colorTextBase: "#000",
		colorTextTertiary: "#999",
		colorWarning: "#faad14",
		borderRadius: 8,
		boxShadowTertiary: "none",
	}),
}));

const textAsset: DataAsset = {
	id: "asset-text-1",
	data_type: "text",
	name: "测试文档.txt",
	status: "approved",
	normalized_markdown: "这是一段测试文本内容",
} as DataAsset;

const qaItem: QAItem = {
	id: "qa-1",
	question: "测试问题",
	answer: "测试答案",
	evidence: "",
	reasoning: "",
	score_bucket: "green",
	status: "generated",
	confidence: 92,
	candidate_models: ["glm-text", "qwen-text"],
} as QAItem;

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: 0 },
			mutations: { retry: false },
		},
	});
}

function renderWithProviders(ui: React.ReactElement) {
	const queryClient = makeQueryClient();
	return render(
		<QueryClientProvider client={queryClient}>
			<AntdApp>{ui}</AntdApp>
		</QueryClientProvider>,
	);
}

describe("data-annotation 数据流", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetchAssets.mockResolvedValue({ items: [textAsset], total: 1 });
		mockListQAByAsset.mockResolvedValue({ items: [qaItem], total: 1 });
		mockFetchQAItem.mockResolvedValue(qaItem);
		mockFetchAssetRaw.mockResolvedValue(new Blob(["x"]));
		mockGenerateQA.mockResolvedValue({
			generated_count: 3,
			green_count: 1,
			orange_count: 1,
			red_count: 1,
		} as QARunResponse);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("挂载即加载资料列表并自动选中首个资料 → 触发 QA 列表查询", async () => {
		renderWithProviders(<DataAnnotation />);

		await waitFor(() => {
			expect(mockFetchAssets).toHaveBeenCalledTimes(1);
		});

		// 自动选中首个资料应触发 listQAByAsset
		await waitFor(() => {
			expect(mockListQAByAsset).toHaveBeenCalledWith("asset-text-1");
		});
	});

	it("资料列表渲染资料名", async () => {
		renderWithProviders(<DataAnnotation />);

		await waitFor(() => {
			expect(screen.getByText("测试文档.txt")).toBeInTheDocument();
		});
	});

	it("文本资料选中时, 生成智能评估按钮可用且点击触发 generateQA 正确 payload", async () => {
		renderWithProviders(<DataAnnotation />);

		await waitFor(() => {
			expect(mockListQAByAsset).toHaveBeenCalledWith("asset-text-1");
		});

		// 工具栏与文本预览区各有一个生成按钮, 取首个
		const btn = screen.getAllByRole("button", { name: /生成智能评估/ })[0];
		await waitFor(() => {
			expect(btn).toBeEnabled();
		});
		btn.click();

		await waitFor(() => {
			expect(mockGenerateQA).toHaveBeenCalledWith(expect.objectContaining({
				asset_id: "asset-text-1",
				modality: "text",
				candidate_models: ["glm-text", "qwen-text"],
				item_count: 3,
			}));
		});
	});

	it("qA 列表渲染后选中标注项 → 触发 fetchQAItem", async () => {
		renderWithProviders(<DataAnnotation />);

		await waitFor(() => {
			expect(mockListQAByAsset).toHaveBeenCalled();
		});

		// 首个 QA 自动选中应触发详情查询
		await waitFor(() => {
			expect(mockFetchQAItem).toHaveBeenCalledWith("qa-1");
		});
	});
});
