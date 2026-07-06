import type { AssetListResponse, DataAsset, QARunResponse } from "#src/api/label-system";
import type { KBSyncResult } from "#src/api/llm-factory/knowledge";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	fetchAssets: vi.fn<() => Promise<AssetListResponse>>(),
	generateQA: vi.fn<() => Promise<QARunResponse>>(),
	syncKnowledge: vi.fn<() => Promise<KBSyncResult>>(),
	deleteAsset: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock("#src/api/label-system", async () => {
	const actual = await vi.importActual<typeof import("#src/api/label-system")>("#src/api/label-system");
	return {
		...actual,
		fetchAssets: mocks.fetchAssets,
		fetchAssetRaw: vi.fn<() => Promise<Blob>>(),
		uploadAsset: vi.fn(),
		deleteAsset: mocks.deleteAsset,
		generateQA: mocks.generateQA,
	};
});

vi.mock("#src/api/llm-factory/knowledge", () => ({
	syncKnowledge: mocks.syncKnowledge,
}));

vi.mock("#src/pages/llm-factory/_shared/theme", () => ({
	useLlmTokens: () => ({
		colorPrimary: "#1677ff",
		colorPrimaryBg: "#e6f4ff",
		colorError: "#ff4d4f",
		colorSuccess: "#52c41a",
		colorInfo: "#1677ff",
		colorWarning: "#faad14",
		colorTextTertiary: "#bfbfbf",
		borderRadius: 6,
	}),
}));

import DataManagement from "./index";

const textAsset: DataAsset = {
	id: "asset-1",
	name: "验收资料.md",
	data_type: "text",
	source: "upload",
	normalized_markdown: "# 验收资料",
	tags: ["audit"],
	status: "approved",
	current_version: 2,
	created_at: "2026-06-20T00:00:00Z",
};
const imageAsset: DataAsset = {
	id: "asset-2",
	name: "设计截图.png",
	data_type: "image",
	source: "upload",
	tags: [],
	status: "ready",
	current_version: 1,
	created_at: "2026-06-21T00:00:00Z",
};

function renderWithProviders() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<AntdApp><DataManagement /></AntdApp>
		</QueryClientProvider>,
	);
}

/** 在渲染的表格中查找资产名称 (渲染为 <a> 链接, 用 within 容器查找). */
function findAssetNames(): string[] {
	const links = document.querySelectorAll("table tbody td a");
	return Array.from(links).map(a => (a.textContent || "").trim());
}

describe("dataManagement page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchAssets.mockResolvedValue({ items: [textAsset, imageAsset], total: 2 });
		mocks.generateQA.mockResolvedValue({ id: "run-1", asset_id: "asset-1", status: "completed", generated_count: 1, green_count: 1, orange_count: 0, red_count: 0, items: [] });
		mocks.syncKnowledge.mockResolvedValue({ success: true, parse_status: "ok" });
		mocks.deleteAsset.mockResolvedValue(undefined);
	});

	it("renders upload + refresh icon button + bulk sync controls", async () => {
		renderWithProviders();

		expect(screen.getByRole("button", { name: /上传资料/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /全部同步知识库/ })).toBeInTheDocument();
		// 刷新按钮 (icon-only ReloadOutlined, 无文字; Tooltip 标题在 jsdom 不进入 accessible name)
		await waitFor(() => {
			const refreshBtn = document.querySelector("button .anticon-reload");
			expect(refreshBtn).not.toBeNull();
		});
		// 上传后自动入库 开关存在
		expect(screen.getByRole("switch")).toBeInTheDocument();
	});

	it("lists all loaded assets in the table", async () => {
		renderWithProviders();

		await waitFor(() => {
			const names = findAssetNames();
			expect(names).toEqual(expect.arrayContaining(["验收资料.md", "设计截图.png"]));
		});
	});

	it("filters assets by name via the search box", async () => {
		renderWithProviders();

		const input = await screen.findByPlaceholderText("搜索资产名称...");
		await waitFor(() => expect(findAssetNames()).toHaveLength(2));

		// 搜索 "验收" → 仅剩文本资产
		fireEvent.change(input, { target: { value: "验收" } });
		await waitFor(() => {
			const names = findAssetNames();
			expect(names).toContain("验收资料.md");
			expect(names).not.toContain("设计截图.png");
		});

		// 清空搜索 → 恢复两项
		fireEvent.change(input, { target: { value: "" } });
		await waitFor(() => expect(findAssetNames()).toHaveLength(2));
	});
});
