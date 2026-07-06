// ============================================================================
// 数据资产管理 (ADR-014 整合 — 源 DataManagement)
// 资产 CRUD: 上传(MarkItDown全格式) / 列表 / 预览 / 删除
// 优化: 搜索 + 排序 + 筛选 / 批量操作 / 并发同步 / 预览 loading 态
// ============================================================================

import type { DataAsset } from "#src/api/label-system";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { deleteAsset, fetchAssetRaw, fetchAssets, generateQA, markKnowledgeSynced, uploadAsset } from "#src/api/label-system";
import { syncKnowledge } from "#src/api/llm-factory/knowledge";
import { QueryState } from "#src/components/query-state";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { CloudUploadOutlined, DatabaseOutlined, DeleteOutlined, EyeOutlined, InboxOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Flex, Image, Input, Modal, Popconfirm, Space, Spin, Switch, Table, Tag, Tooltip, Typography, Upload } from "antd";
import type { Key } from "react";
import { useMemo, useState } from "react";

const { Paragraph, Text } = Typography;
const ASSET_TYPE_LABEL: Record<string, string> = { text: "文本", image: "图片", video: "视频" };
const STATUS_LABEL: Record<string, string> = { ready: "就绪", pending_review: "待审核", approved: "已通过", generated: "已生成", parse_failed: "失败" };
const TYPE_COLOR: Record<string, string> = { text: "geekblue", image: "purple", video: "magenta" };
const STATUS_COLOR: Record<string, string> = { approved: "green", pending_review: "orange", parse_failed: "red", ready: "blue" };

/** 并发执行任务, 限制最大并发数 (避免批量同步串行阻塞). */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
	const queue = items.map((item, index) => ({ item, index }));
	const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (queue.length > 0) {
			const next = queue.shift();
			if (!next)
				return;
			await worker(next.item, next.index);
		}
	});
	await Promise.all(runners);
}

export default function DataManagement() {
	const token = useLlmTokens();
	const queryClient = useQueryClient();
	const [previewAsset, setPreviewAsset] = useState<DataAsset | null>(null);
	const [previewContent, setPreviewContent] = useState<string>("");
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [autoSyncKB, setAutoSyncKB] = useState(false); // 上传后自动同步知识库
	const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
	const [bulkSyncing, setBulkSyncing] = useState(false);

	// ★ 客户端搜索 + 排序 + 筛选状态
	const [searchText, setSearchText] = useState("");
	const [typeFilter, setTypeFilter] = useState<FilterValue | null>(null);
	const [statusFilter, setStatusFilter] = useState<FilterValue | null>(null);
	const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

	const assetsQuery = useQuery({ queryKey: ["ls-assets"], queryFn: fetchAssets, staleTime: 60_000 });
	const assets = assetsQuery.data?.items ?? [];

	// ★ 客户端筛选 (名称模糊 + 类型 + 状态)
	const filteredAssets = useMemo(() => {
		return assets.filter((a) => {
			const matchName = !searchText || a.name.toLowerCase().includes(searchText.toLowerCase());
			const matchType = !typeFilter || typeFilter.length === 0 || typeFilter.includes(a.data_type);
			const matchStatus = !statusFilter || statusFilter.length === 0 || statusFilter.includes(a.status);
			return matchName && matchType && matchStatus;
		});
	}, [assets, searchText, typeFilter, statusFilter]);

	const syncSingleAsset = async (id: string, name: string, markdownFallback: string): Promise<boolean> => {
		try {
			const res = await syncKnowledge(name, markdownFallback);
			if (res.success) {
				window.$message?.success({ content: `「${name}」已同步知识库 (${res.parse_status})`, key: "auto-sync" });
				// ★ 持久化同步状态到后端 (避免刷新丢失)
				try {
					await markKnowledgeSynced(id, true);
					queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
				}
				catch (e) {
					// 标记失败不影响同步本身, 下次可重试
					console.warn("持久化同步状态失败:", e);
				}
				return true;
			}
			window.$message?.error({ content: `同步失败: ${res.error || "未知"}`, key: "auto-sync" });
			return false;
		}
		catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			window.$message?.error({ content: `同步失败: ${msg}`, key: "auto-sync" });
			return false;
		}
		finally {
			setSyncingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
		}
	};

	const uploadMutation = useMutation({
		mutationFn: ({ file, name }: { file: File, name: string }) => uploadAsset(file, name),
		onSuccess: async (asset, vars) => {
			window.$message?.success("上传成功，智能解析完成");
			queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
			// ★ 文本资产: 自动启动双模型智能标注 (ADR-014 数据飞轮闭环)
			if (asset.data_type === "text" && asset.normalized_markdown) {
				window.$message?.loading({ content: `正在对「${vars.name}」启动 GLM+Qwen 双模型自动标注...`, key: "auto-annotate", duration: 0 });
				try {
					const res = await generateQA({ asset_id: asset.id, modality: "text", candidate_models: ["glm-text", "qwen-text"], item_count: 3 });
					window.$message?.success({
						content: `自动标注完成: 生成 ${res.generated_count} 条 (绿${res.green_count}/橙${res.orange_count}/红${res.red_count})`,
						key: "auto-annotate",
						duration: 6,
					});
					queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
				}
				catch (e: unknown) {
					const msg = e instanceof Error ? e.message : String(e);
					window.$message?.warning({ content: `自动标注未完成: ${msg || "请到标注工作台手动生成"}`, key: "auto-annotate", duration: 8 });
				}
			}
			// 上传后自动同步知识库 (开关开启时)
			if (autoSyncKB && asset.data_type === "text" && asset.normalized_markdown) {
				window.$message?.loading({ content: `正在同步「${vars.name}」到知识库...`, key: "auto-sync", duration: 0 });
				const synced = await syncSingleAsset(asset.id, vars.name, asset.normalized_markdown);
				if (!synced) {
					window.$message?.warning({ content: "自动入库未完成，可稍后手动同步", key: "auto-sync", duration: 6 });
				}
			}
		},
		onError: (e: any) => window.$message?.error(e?.message || "上传失败"),
	});

	// ★ 批量同步: 并发执行 (4 并发上限), 取代串行
	const syncAllTextAssets = async (targets?: DataAsset[]) => {
		const textAssets = (targets ?? assets).filter(a => a.data_type === "text" && a.normalized_markdown);
		if (textAssets.length === 0) {
			window.$message?.warning("没有可同步的文本资产 (需含 Markdown 内容)");
			return;
		}
		setBulkSyncing(true);
		window.$message?.loading({ content: `批量同步 ${textAssets.length} 个资产 (并发)...`, key: "sync-all", duration: 0 });
		let ok = 0;
		await runWithConcurrency(textAssets, 4, async (asset) => {
			setSyncingIds(prev => new Set(prev).add(asset.id));
			try {
				const res = await syncKnowledge(asset.name, asset.normalized_markdown!);
				if (res.success) {
					ok++;
					// ★ 持久化同步状态 (批量)
					await markKnowledgeSynced(asset.id, true).catch(() => {});
				}
			}
			catch { /* 继续 */ }
			setSyncingIds((prev) => { const n = new Set(prev); n.delete(asset.id); return n; });
		});
		setBulkSyncing(false);
		setSelectedRowKeys([]);
		queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
		window.$message?.success({ content: `同步完成: ${ok}/${textAssets.length} 个资产已入库`, key: "sync-all", duration: 4 });
	};

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteAsset(id),
		onSuccess: () => {
			window.$message?.success("已删除");
			queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "删除失败"),
	});

	// ★ 批量删除
	const bulkDeleteMutation = useMutation({
		mutationFn: async (ids: Key[]) => Promise.all(ids.map(id => deleteAsset(String(id)))),
		onSuccess: (_data, ids) => {
			window.$message?.success(`已删除 ${ids.length} 项`);
			setSelectedRowKeys([]);
			queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "批量删除失败"),
	});

	const openPreview = async (asset: DataAsset) => {
		setPreviewAsset(asset);
		setPreviewContent("");
		setPreviewUrl(null);
		if (asset.data_type === "text") {
			setPreviewContent(asset.normalized_markdown || "（无 Markdown 内容）");
		}
		else {
			// ★ 预览 loading 态
			setPreviewLoading(true);
			try {
				const blob = await fetchAssetRaw(asset.id);
				setPreviewUrl(URL.createObjectURL(blob));
			}
			catch {
				setPreviewContent("预览加载失败");
			}
			finally {
				setPreviewLoading(false);
			}
		}
	};

	// 类型/状态筛选选项 (基于实际数据动态生成)
	const typeOptions = useMemo(
		() => Array.from(new Set(assets.map(a => a.data_type))).map(v => ({ text: ASSET_TYPE_LABEL[v] || v, value: v })),
		[assets],
	);
	const statusOptions = useMemo(
		() => Array.from(new Set(assets.map(a => a.status))).map(v => ({ text: STATUS_LABEL[v] || v, value: v })),
		[assets],
	);
	const hasTags = useMemo(() => assets.some(a => (a.tags || []).length > 0), [assets]);

	const columns: ColumnsType<DataAsset> = [
		{
			title: "名称",
			dataIndex: "name",
			ellipsis: true,
			sorter: (a, b) => a.name.localeCompare(b.name, "zh-CN"),
			render: (v: string, r) => (
				<Space>
					<a onClick={() => openPreview(r)}>{v}</a>
				</Space>
			),
		},
		{
			title: "类型",
			dataIndex: "data_type",
			width: 90,
			filters: typeOptions,
			filteredValue: typeFilter,
			onFilter: (value, r) => r.data_type === value,
			render: (v: string) => <Tag color={TYPE_COLOR[v] || "default"}>{ASSET_TYPE_LABEL[v] || v}</Tag>,
		},
		{
			title: "状态",
			dataIndex: "status",
			width: 100,
			filters: statusOptions,
			filteredValue: statusFilter,
			onFilter: (value, r) => r.status === value,
			render: (v: string) => <Tag color={STATUS_COLOR[v] || "blue"}>{STATUS_LABEL[v] || v}</Tag>,
		},
		// ★ 仅当存在带标签资产时才展示标签列 (避免空列占位)
		...(hasTags
			? [{
					title: "标签",
					dataIndex: "tags" as keyof DataAsset,
					render: (tags: string[]) => (tags || []).map(t => <Tag key={t}>{t}</Tag>),
				}]
			: []),
		{
			title: "创建时间",
			dataIndex: "created_at",
			width: 170,
			sorter: (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
			defaultSortOrder: "descend",
			render: (v: string) => (v ? new Date(v).toLocaleString("zh-CN") : "-"),
		},
		{
			title: "操作",
			width: 200,
			render: (_, r) => (
				<Space>
					<Button size="small" icon={<EyeOutlined />} aria-label="预览" onClick={() => openPreview(r)}>
						预览
					</Button>
					{r.data_type === "text" && r.normalized_markdown && !r.knowledge_base_synced && (
						<Tooltip title="同步到知识库 (向量检索)">
							<Button
								size="small"
								icon={<DatabaseOutlined />}
								loading={syncingIds.has(r.id)}
								onClick={async () => {
									setSyncingIds(prev => new Set(prev).add(r.id));
									await syncSingleAsset(r.id, r.name, r.normalized_markdown!);
								}}
							>
								入库
							</Button>
						</Tooltip>
					)}
					{r.knowledge_base_synced && <Tag color="green">已入库</Tag>}
					<Popconfirm title="确认删除?" onConfirm={() => deleteMutation.mutate(r.id)}>
						<Button size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	const pagination: TablePaginationConfig = {
		pageSize: 10,
		showSizeChanger: true,
		showTotal: total => `共 ${total} 项`,
	};

	const handleChange = (_pg: unknown, _filters: Record<string, FilterValue | null>, sorter: SorterResult<DataAsset> | SorterResult<DataAsset>[]) => {
		const f = (_filters as Record<string, FilterValue | null>);
		setTypeFilter(f.data_type ?? null);
		setStatusFilter(f.status ?? null);
		void f;
		void sorter; // 排序由 sorter prop 在列内处理
	};

	return (
		<Space orientation="vertical" size={16} className="w-full">
			<Card variant="borderless">
				<Flex wrap="wrap" gap={12} align="center" justify="between">
					<Flex wrap="wrap" gap={8} align="center">
						<Upload
							accept=".txt,.md,.pdf,.docx,.doc,.pptx,.xlsx,.xls,.csv,.json,.yaml,.yml,.html,.png,.jpg,.jpeg,.mp4,.mov"
							showUploadList={false}
							multiple
							beforeUpload={(file) => {
								uploadMutation.mutate({ file, name: file.name });
								return false;
							}}
						>
							<Button type="primary" icon={<InboxOutlined />} loading={uploadMutation.isPending}>
								上传资料 (全格式智能解析)
							</Button>
						</Upload>
						<Tooltip title="刷新列表">
							<Button icon={<ReloadOutlined />} onClick={() => assetsQuery.refetch()} loading={assetsQuery.isFetching && !assetsQuery.isLoading} />
						</Tooltip>
						<Popconfirm title="同步全部文本资产到知识库?" onConfirm={() => syncAllTextAssets()}>
							<Button icon={<CloudUploadOutlined />} loading={bulkSyncing}>
								全部同步知识库
							</Button>
						</Popconfirm>
						<Flex gap={4} align="center">
							<Switch checked={autoSyncKB} onChange={setAutoSyncKB} size="small" />
							<Text type="secondary" className="text-xs">上传后自动入库</Text>
						</Flex>
					</Flex>
					{/* ★ 客户端搜索框 */}
					<Input
						allowClear
						prefix={<SearchOutlined />}
						placeholder="搜索资产名称..."
						style={{ width: 240 }}
						value={searchText}
						onChange={e => setSearchText(e.target.value)}
					/>
				</Flex>
			</Card>

			<Card variant="borderless">
				<QueryState
					isLoading={assetsQuery.isLoading}
					isError={assetsQuery.isError}
					isEmpty={assets.length === 0}
					error={assetsQuery.error}
					onRetry={() => assetsQuery.refetch()}
					emptyText="暂无数据，请上传资料"
				>
					{/* ★ 批量操作工具栏 (仅选中行时显示) */}
					{selectedRowKeys.length > 0 && (
						<Flex gap={8} align="center" style={{ marginBottom: 12, padding: "8px 12px", background: token.colorPrimaryBg, borderRadius: token.borderRadius }}>
							<Text strong>已选 {selectedRowKeys.length} 项</Text>
							<Popconfirm title={`确认同步选中的 ${selectedRowKeys.length} 项到知识库?`} onConfirm={() => syncAllTextAssets(assets.filter(a => selectedRowKeys.includes(a.id)))}>
								<Button size="small" icon={<DatabaseOutlined />} loading={bulkSyncing}>批量入库</Button>
							</Popconfirm>
							<Popconfirm title={`确认删除选中的 ${selectedRowKeys.length} 项?`} onConfirm={() => bulkDeleteMutation.mutate(selectedRowKeys)}>
								<Button size="small" danger icon={<DeleteOutlined />} loading={bulkDeleteMutation.isPending}>批量删除</Button>
							</Popconfirm>
							<Button size="small" type="link" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
						</Flex>
					)}
					<Table<DataAsset>
						columns={columns}
						dataSource={filteredAssets}
						rowKey="id"
						pagination={pagination}
						onChange={handleChange}
						rowSelection={{
							selectedRowKeys,
							onChange: setSelectedRowKeys,
						}}
					/>
				</QueryState>
			</Card>

			<Modal
				title={previewAsset?.name}
				open={!!previewAsset}
				onCancel={() => {
					setPreviewAsset(null);
					if (previewUrl)
						URL.revokeObjectURL(previewUrl);
				}}
				footer={null}
				width={800}
			>
				{previewAsset?.data_type === "text"
					? (
						<Paragraph style={{ whiteSpace: "pre-wrap", maxHeight: 500, overflow: "auto" }}>{previewContent}</Paragraph>
					)
					: previewLoading
						? (
							// ★ 预览 loading 态 (图片/视频加载中)
							<Flex justify="center" align="center" style={{ height: 320 }}>
								<Spin tip="加载预览中..." />
							</Flex>
						)
						: previewUrl
							? (
								previewAsset?.data_type === "image"
									? (
										<Image src={previewUrl} className="max-w-full" />
									)
									: (
										<video src={previewUrl} controls className="w-full" />
									)
							)
							: (
								<Text>加载中...</Text>
							)}
			</Modal>
		</Space>
	);
}
