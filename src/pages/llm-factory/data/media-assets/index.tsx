import { fetchMediaAssetList, fetchMediaAssetStats } from "#src/api/llm-factory";
import { uploadMediaAsset } from "#src/api/llm-factory/factory-client";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Modal, Row, Select, Space, Tag, Typography } from "antd";
import { useRef, useState } from "react";

const { Text } = Typography;

type MediaType = "all" | "image" | "video";
type TaskFilter = "all" | "IMAGE_CAPTION" | "IMAGE_QA" | "VIDEO_QA" | "VIDEO_CAPTION";

function formatFileSize(bytes: number): string {
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(0)} KB`;
	}
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
	return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatResolution(width?: number, height?: number): string {
	if (!width || !height)
		return "—";
	return `${width}×${height}`;
}

function formatDuration(seconds?: number): string {
	if (!seconds)
		return "—";
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `0:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function LLMFactoryMediaAssets() {
	const token = useLlmTokens();
	const { data: stats, error: statsError, isError: isStatsError, refetch: refetchStats } = useQuery({
		queryKey: ["llm-factory", "media-assets", "stats"],
		queryFn: () => fetchMediaAssetStats().then(r => r.result),
	});

	const [mediaType, setMediaType] = useState<MediaType>("all");
	const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
	const [selectedAsset, setSelectedAsset] = useState<any>(null);
	const [detailModalOpen, setDetailModalOpen] = useState(false);
	const [uploadMediaType, setUploadMediaType] = useState("image");
	const [uploadTaskType, setUploadTaskType] = useState("IMAGE_CAPTION");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	const uploadMutation = useMutation({
		mutationFn: (file: File) => uploadMediaAsset(file, uploadMediaType, uploadTaskType),
		onSuccess: () => {
			window.$message?.success("上传成功");
			queryClient.invalidateQueries({ queryKey: ["llm-factory", "media-assets"] });
		},
		onError: (err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			window.$message?.error(msg);
		},
	});

	const handleUploadClick = () => fileInputRef.current?.click();
	const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) uploadMutation.mutate(file);
		e.target.value = "";
	};

	const { data: assetsData, error: assetsError, isError: isAssetsError, refetch: refetchAssets } = useQuery({
		queryKey: ["llm-factory", "media-assets", "list", mediaType, taskFilter],
		queryFn: () =>
			fetchMediaAssetList({
				type: mediaType === "all" ? undefined : mediaType,
				taskCategory: taskFilter === "all" ? undefined : taskFilter,
			}).then(r => r.result),
	});

	const handleShowDetail = (asset: any) => {
		setSelectedAsset(asset);
		setDetailModalOpen(true);
	};

	return (
		<BasicContent>
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">媒体资源</h2>
				<p className="mb-0 ml-0 mr-0 mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
					图像/视频文件管理与上传。支持 image_caption、image_qa、video_qa、video_caption 任务类型的媒体关联。
				</p>
			</div>
			{isStatsError && <QueryErrorAlert error={statsError} onRetry={() => void refetchStats()} title="媒体统计真实接口不可用" />}
			{isAssetsError && <QueryErrorAlert error={assetsError} onRetry={() => void refetchAssets()} title="媒体列表真实接口不可用" />}

			{/* Stats */}
			<Row className="mb-6" gutter={16}>
				<Col span={6}>
					<Card
						className="rounded-[12px]"
						style={{
							border: `1px solid ${token.colorBorder}`,
						}}
					>
						<Row align="middle" gutter={16}>
							<Col flex="1">
								<div className="font-mono text-2xl font-bold" style={{ color: CHART_COLORS.primary }}>
									{stats?.imageCount || 0}
								</div>
								<div className="mt-1 text-xs" style={{ color: token.colorTextTertiary }}>图像文件</div>
							</Col>
							<Col>
								<div
									className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[rgba(22,93,255,0.1)]"
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24" style={{ color: CHART_COLORS.primary }}>
										<rect x="3" y="3" width="18" height="18" rx="2" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<polyline points="21 15 16 10 5 21" />
									</svg>
								</div>
							</Col>
						</Row>
					</Card>
				</Col>
				<Col span={6}>
					<Card
						className="rounded-[12px]"
						style={{
							border: `1px solid ${token.colorBorder}`,
						}}
					>
						<Row align="middle" gutter={16}>
							<Col flex="1">
								<div className="font-mono text-2xl font-bold" style={{ color: CHART_COLORS.blue }}>
									{stats?.videoCount || 0}
								</div>
								<div className="mt-1 text-xs" style={{ color: token.colorTextTertiary }}>视频文件</div>
							</Col>
							<Col>
								<div
									className="flex h-12 w-12 items-center justify-center rounded-[12px]"
									style={{
										background: token.colorPrimaryBg,
									}}
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24" style={{ color: CHART_COLORS.blue }}>
										<polygon points="23 7 16 12 23 17 23 7" />
										<rect x="1" y="5" width="15" height="14" rx="2" />
									</svg>
								</div>
							</Col>
						</Row>
					</Card>
				</Col>
				<Col span={6}>
					<Card
						className="rounded-[12px]"
						style={{
							border: `1px solid ${token.colorBorder}`,
						}}
					>
						<Row align="middle" gutter={16}>
							<Col flex="1">
								<div className="font-mono text-2xl font-bold" style={{ color: token.colorWarning }}>
									{stats ? formatFileSize(stats.totalStorageBytes) : "—"}
								</div>
								<div className="mt-1 text-xs" style={{ color: token.colorTextTertiary }}>总存储量</div>
							</Col>
							<Col>
								<div
									className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[rgba(250,140,22,0.1)]"
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24" style={{ color: token.colorWarning }}>
										<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
									</svg>
								</div>
							</Col>
						</Row>
					</Card>
				</Col>
				<Col span={6}>
					<Card
						className="rounded-[12px]"
						style={{
							border: `1px solid ${token.colorBorder}`,
						}}
					>
						<Row align="middle" gutter={16}>
							<Col flex="1">
								<div className="font-mono text-2xl font-bold" style={{ color: CHART_COLORS.success }}>
									{stats?.taskTypeCoverage || 0}
								</div>
								<div className="mt-1 text-xs" style={{ color: token.colorTextTertiary }}>任务类型覆盖</div>
							</Col>
							<Col>
								<div
									className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[rgba(82,196,26,0.1)]"
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24" style={{ color: CHART_COLORS.success }}>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</div>
							</Col>
						</Row>
					</Card>
				</Col>
			</Row>

			{/* Upload Zone */}
			<Card
				className="mb-4 cursor-pointer rounded-[12px]"
				style={{
					border: `2px solid ${token.colorBorder}`,
				}}
				styles={{ body: {
					padding: 32,
					textAlign: "center",
				} }}
			>
				<div className="mb-3">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="36" height="36" style={{ color: token.colorBorder }}>
						<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>
				</div>
				<div className="mb-1 text-base font-medium">拖拽文件到此处或点击上传</div>
				<div className="mb-3 text-xs" style={{ color: token.colorTextTertiary }}>支持 PNG / JPG / MP4 / WebM，单文件 ≤ 200 MB</div>
				<Space>
					<input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} accept="image/*,video/*" />
					<Select className="w-[100px]" value={uploadMediaType} onChange={setUploadMediaType} options={[{ label: "图像文件", value: "image" }, { label: "视频文件", value: "video" }]} />
					<Select
						className="w-[140px]"
						value={uploadTaskType}
						onChange={setUploadTaskType}
						options={[
							{ label: "image_caption", value: "IMAGE_CAPTION" },
							{ label: "image_qa", value: "IMAGE_QA" },
							{ label: "video_qa", value: "VIDEO_QA" },
							{ label: "video_caption", value: "VIDEO_CAPTION" },
						]}
					/>
					<Button type="primary" loading={uploadMutation.isPending} onClick={handleUploadClick}>上传</Button>
				</Space>
			</Card>

			{/* Filters */}
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<Text className="text-xs" style={{ color: token.colorTextTertiary }}>类型：</Text>
				<Space size={8}>
					{(["all", "image", "video"] as MediaType[]).map(type => (
						<button
							className="cursor-pointer rounded-full px-[14px] py-1 text-xs"
							key={type}
							type="button"
							onClick={() => setMediaType(type)}
							style={{
								border: `1px solid ${token.colorBorder}`,
								background: mediaType === type ? "#1890ff" : "#fff",
								color: mediaType === type ? "#fff" : "#666",
							}}
						>
							{type === "all" ? "全部" : type === "image" ? "图像" : "视频"}
						</button>
					))}
				</Space>
				<span className="ml-auto text-xs" style={{ color: token.colorTextTertiary }}>任务类型：</span>
				<Space size={8}>
					{(["all", "IMAGE_CAPTION", "IMAGE_QA", "VIDEO_QA", "VIDEO_CAPTION"] as TaskFilter[]).map(task => (
						<button
							className="cursor-pointer rounded-full px-[14px] py-1 text-xs"
							key={task}
							type="button"
							onClick={() => setTaskFilter(task)}
							style={{
								border: `1px solid ${token.colorBorder}`,
								background: taskFilter === task ? "#1890ff" : "#fff",
								color: taskFilter === task ? "#fff" : "#666",
							}}
						>
							{task === "all" ? "全部" : task.replace("_", "_").toLowerCase()}
						</button>
					))}
				</Space>
			</div>

			{/* Media Grid */}
			<div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
				{assetsData?.records.map(asset => (
					<div
						className="cursor-pointer overflow-hidden rounded-[12px] transition-[box-shadow,border-color] duration-150"
						key={asset.id}
						onClick={() => handleShowDetail(asset)}
						style={{
							background: token.colorBgContainer,
							border: `1px solid ${token.colorBorder}`,
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
							e.currentTarget.style.borderColor = "#1890ff";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.boxShadow = "none";
							e.currentTarget.style.borderColor = "#f0f0f0";
						}}
					>
						<div
							className="relative flex h-[140px] items-center justify-center"
							style={{
								background: asset.type === "video" ? "#0A1A3A" : "#fafafa",
							}}
						>
							<svg
								className="opacity-25"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								width="40"
								height="40"
							>
								{asset.type === "video"
									? (
										<>
											<polygon points="23 7 16 12 23 17 23 7" />
											<rect x="1" y="5" width="15" height="14" rx="2" />
										</>
									)
									: (
										<>
											<rect x="3" y="3" width="18" height="18" rx="2" />
											<circle cx="8.5" cy="8.5" r="1.5" />
											<polyline points="21 15 16 10 5 21" />
										</>
									)}
							</svg>
							<span
								className="absolute right-2 top-2 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase"
								style={{
									background: asset.type === "image" ? "rgba(22,93,255,0.15)" : "rgba(89,126,247,0.15)",
									color: asset.type === "image" ? "#1890ff" : "#597EF7",
								}}
							>
								{asset.type === "image" ? "IMG" : "VID"}
							</span>
						</div>
						<div className="px-4 py-3">
							<div className="mb-1 break-all font-mono text-[11px]" style={{ color: token.colorTextTertiary }}>
								{asset.mediaId}
							</div>
							<div className="flex gap-3 text-[11px]" style={{ color: token.colorTextTertiary }}>
								<span>{formatFileSize(asset.fileSize)}</span>
								<span>{asset.type === "image" ? formatResolution(asset.width, asset.height) : formatDuration(asset.duration)}</span>
								<span>{new Date(asset.uploadedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}</span>
							</div>
							<Tag
								className="mt-[6px] rounded-full px-2 py-px text-[10px]"
								color="cyan"
							>
								{asset.taskCategory.toLowerCase()}
							</Tag>
						</div>
					</div>
				))}
			</div>

			{/* Pagination */}
			<div className="mt-6 flex justify-center gap-2">
				<Button size="small" disabled>
					上一页
				</Button>
				<span className="px-3 py-1 text-xs" style={{ color: token.colorTextTertiary }}>
					1 /
					{" "}
					{Math.ceil((assetsData?.total || 0) / 20)}
				</span>
				<Button size="small">下一页</Button>
			</div>

			{/* Detail Modal */}
			<Modal
				open={detailModalOpen}
				onCancel={() => setDetailModalOpen(false)}
				footer={null}
				width={640}
				title={<span className="text-base font-semibold">媒体详情</span>}
			>
				{selectedAsset && (
					<div>
						<div
							className="mb-4 flex h-[200px] w-full items-center justify-center rounded-lg"
							style={{
								background: selectedAsset.type === "video" ? "#0A1A3A" : "#fafafa",
							}}
						>
							<svg className="opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
								{selectedAsset.type === "video"
									? (
										<>
											<polygon points="23 7 16 12 23 17 23 7" />
											<rect x="1" y="5" width="15" height="14" rx="2" />
										</>
									)
									: (
										<>
											<rect x="3" y="3" width="18" height="18" rx="2" />
											<circle cx="8.5" cy="8.5" r="1.5" />
											<polyline points="21 15 16 10 5 21" />
										</>
									)}
							</svg>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>media_id</div>
								<div className="font-mono text-xs">{selectedAsset.mediaId}</div>
							</div>
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>类型</div>
								<div className="font-mono text-xs">{selectedAsset.type}</div>
							</div>
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>文件大小</div>
								<div className="font-mono text-xs">{formatFileSize(selectedAsset.fileSize)}</div>
							</div>
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>MIME</div>
								<div className="font-mono text-xs">{selectedAsset.mimeType}</div>
							</div>
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>
									{selectedAsset.type === "image" ? "分辨率" : "时长"}
								</div>
								<div className="font-mono text-xs">
									{selectedAsset.type === "image"
										? formatResolution(selectedAsset.width, selectedAsset.height)
										: formatDuration(selectedAsset.duration)}
								</div>
							</div>
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>任务类型</div>
								<div className="font-mono text-xs">{selectedAsset.taskCategory.toLowerCase()}</div>
							</div>
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>SHA256</div>
								<div className="font-mono text-[11px]">
									{selectedAsset.sha256.slice(0, 16)}
									…
								</div>
							</div>
							<div>
								<div className="mb-[2px] text-[11px]" style={{ color: token.colorTextTertiary }}>上传时间</div>
								<div className="font-mono text-xs">{new Date(selectedAsset.uploadedAt).toLocaleString("zh-CN")}</div>
							</div>
						</div>
					</div>
				)}
			</Modal>
		</BasicContent>
	);
}
