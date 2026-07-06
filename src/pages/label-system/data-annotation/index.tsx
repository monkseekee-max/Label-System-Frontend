// ============================================================================
// 数据标注工作台 (统一文本/图片/视频标注)
// 合并自原 annotation-workspace + image-annotation + video-annotation
// 工作流: 上传/选择资料 → 内容预览 → 多模态精细标注 → 置信度分桶 → 落库为标注项
//         → 单条编辑 → 双模型对比 → 审核 → 流程历史
// 布局 (IDE 风格三栏, 固定视口高度, 各面板独立滚动 — 不再整页长滚动):
//   ┌ 顶栏 (标题 + 统计 + 工具, 紧凑)
//   ┌──────┬────────────────────────┬──────────────────┐
//   │ 资料  │  预览 + 标注操作 (滚动) │ 标注项列表(滚动)  │
//   │ 列表  │                        ├──────────────────┤
//   │ (滚动)│                        │ 单条处理 (滚动)   │
//   └──────┴────────────────────────┴──────────────────┘
// 多模态交互:
//   - 文本: normalized_markdown 预览 + QA 生成
//   - 图片: overlay 框选区域 + 区域标签 → 裁剪 → 双模型区域精标
//   - 视频: Slider 时间区间 → 自动抽帧 → 关键帧 / 时间窗多模型分析
// ============================================================================

import type { QAItem, RegionAnalysisResult, VideoFrameAnalysisResult, VideoWindowAnalysisResult, WorkflowHistoryEntry } from "#src/api/label-system";
import type { AnalysisHistoryEntry, DetailAnalysis, VideoWindowState } from "./types";
import {
	analyzeRegion,
	DEFAULT_IMAGE_REGION_LABEL,
	DEFAULT_VIDEO_TRAJECTORY_LABEL,
	fetchAssets,
	fetchQAItem,
	IMAGE_REGION_LABELS,
	listQAByAsset,
	qaItemWorkflowHistory,
	VIDEO_TRAJECTORY_LABELS,
} from "#src/api/label-system";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import {
	CheckCircleOutlined,
	CloseCircleOutlined,
	DatabaseOutlined,
	EditOutlined,
	FileTextOutlined,
	HistoryOutlined,
	InboxOutlined,
	PictureOutlined,
	PlayCircleOutlined,
	ReloadOutlined,
	SaveOutlined,
	ScanOutlined,
	ScissorOutlined,
	SearchOutlined,
	ThunderboltOutlined,
	VideoCameraOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, AutoComplete, Button, Card, Col, Drawer, Empty, Input, InputNumber, Row, Segmented, Select, Slider, Space, Statistic, Tag, Timeline, Tooltip, Typography, Upload } from "antd";
import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";
import { VoteDetailsPanel } from "../_components/VoteDetailsPanel";
import { useImageSelection } from "./_hooks/use-image-selection";
import { useVideoCapture } from "./_hooks/use-video-capture";
import { ASSET_TYPE_LABEL, BUCKET_COLOR, BUCKET_TITLE, STATUS_LABEL } from "./constants";
import { buildWindowSampleTimestamps, formatTimestampTag, getRecommendation, hexToRgba, isPendingReview, isReviewedOk, previewText } from "./helpers";
import { useAnnotationMutations } from "./use-annotation-mutations";
import { useAssetPreview } from "./use-asset-preview";

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

// 面板外壳: 统一 Card 样式 + 可控高度 + 内部滚动 (IDE 面板风格)
// Markdown 渲染 (用 marked 解析 + token 驱动样式, 暗黑模式自适应)
function MarkdownView({ content }: { content: string }) {
	const token = useLlmTokens();
	const html = useMemo(() => {
		try {
			return String(marked.parse(content || "", { breaks: true, gfm: true, async: false }));
		}
		catch {
			return content || "";
		}
	}, [content]);
	const css = useMemo(() => {
		const s = token;
		return [
			`.anno-md{font-size:13px;line-height:1.75;color:${s.colorText};word-break:break-word}`,
			".anno-md h1,.anno-md h2,.anno-md h3,.anno-md h4,.anno-md h5,.anno-md h6{font-weight:600;margin:1em 0 .5em;line-height:1.3}",
			`.anno-md h1{font-size:1.5em;border-bottom:1px solid ${s.colorBorderSecondary};padding-bottom:.3em;margin-top:.2em}`,
			`.anno-md h2{font-size:1.3em;border-bottom:1px solid ${s.colorBorderSecondary};padding-bottom:.3em}`,
			".anno-md h3{font-size:1.15em}",
			".anno-md h4,.anno-md h5,.anno-md h6{font-size:1em}",
			".anno-md p{margin:0 0 .6em}",
			".anno-md ul,.anno-md ol{margin:0 0 .6em;padding-left:1.6em}",
			".anno-md li{margin:.2em 0}",
			".anno-md li>input[type=checkbox]{margin-inline-end:.4em}",
			`.anno-md a{color:${s.colorPrimary};text-decoration:none}`,
			".anno-md a:hover{text-decoration:underline}",
			".anno-md strong{font-weight:600}",
			`.anno-md blockquote{margin:0 0 .6em;padding:.3em .9em;border-left:3px solid ${s.colorBorder};color:${s.colorTextSecondary};background:${s.colorFillQuaternary};border-radius:0 ${s.borderRadius}px ${s.borderRadius}px 0}`,
			".anno-md blockquote p:last-child{margin-bottom:0}",
			`.anno-md code{background:${s.colorFillQuaternary};padding:.15em .4em;border-radius:${s.borderRadiusSM}px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}`,
			`.anno-md pre{background:${s.colorFillQuaternary};padding:12px;border-radius:${s.borderRadius}px;overflow-x:auto;margin:0 0 .6em;border:1px solid ${s.colorBorderSecondary}}`,
			".anno-md pre code{background:none;padding:0;font-size:.9em}",
			".anno-md table{border-collapse:collapse;width:100%;margin:0 0 .6em;font-size:.95em;display:block;overflow-x:auto}",
			`.anno-md th,.anno-md td{border:1px solid ${s.colorBorderSecondary};padding:6px 10px;text-align:left}`,
			`.anno-md th{background:${s.colorFillQuaternary};font-weight:600}`,
			`.anno-md hr{border:none;border-top:1px solid ${s.colorBorderSecondary};margin:1em 0}`,
			".anno-md img{max-width:100%}",
		].join("\n");
	}, [token]);
	return (
		<>
			<style>{css}</style>
			<div className="anno-md" dangerouslySetInnerHTML={{ __html: html }} />
		</>
	);
}

// 可拖拽分隔条 (列宽调整) — 增量式拖动, 支持 hover/active 高亮
function VSplitter({ onDrag, token }: { onDrag: (delta: number) => void, token: ReturnType<typeof useLlmTokens> }) {
	const [hover, setHover] = useState(false);
	const [active, setActive] = useState(false);
	const lastX = useRef(0);
	const onDown = (e: React.MouseEvent) => {
		e.preventDefault();
		setActive(true);
		lastX.current = e.clientX;
		const onMove = (ev: MouseEvent) => {
			const delta = ev.clientX - lastX.current;
			lastX.current = ev.clientX;
			if (delta !== 0)
				onDrag(delta);
		};
		const onUp = () => {
			setActive(false);
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	};
	const highlight = hover || active;
	return (
		<div
			role="separator"
			aria-orientation="vertical"
			onMouseDown={onDown}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{ flex: "0 0 8px", cursor: "col-resize", display: "flex", alignItems: "stretch", justifyContent: "center", position: "relative", zIndex: 6 }}
		>
			<div style={{ width: 3, alignSelf: "stretch", background: highlight ? token.colorPrimary : token.colorSplit, borderRadius: 2, transition: "background 0.15s" }} />
		</div>
	);
}

function Panel({ title, icon, extra, children, bodyStyle, fill }: {
	title: string
	icon?: React.ReactNode
	extra?: React.ReactNode
	children: React.ReactNode
	bodyStyle?: React.CSSProperties
	fill?: boolean
}) {
	const token = useLlmTokens();
	return (
		<Card
			size="small"
			variant="borderless"
			style={{ background: token.colorBgContainer, width: "100%", minWidth: 0, height: fill ? "100%" : undefined, display: fill ? "flex" : undefined, flexDirection: fill ? "column" : undefined }}
			styles={{ header: { minHeight: 40, padding: "0 12px", flex: fill ? "none" : undefined }, body: { padding: 8, overflowY: "auto", overflowX: "hidden", minWidth: 0, flex: fill ? "1" : undefined, ...bodyStyle } }}
			title={(
				<Space size={6}>
					{icon}
					{title}
				</Space>
			)}
			extra={extra}
		>
			{children}
		</Card>
	);
}

export default function DataAnnotation() {
	const token = useLlmTokens();
	const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
	const [selectedQaId, setSelectedQaId] = useState<string | null>(null);
	const [assetTypeFilter, setAssetTypeFilter] = useState<string>("all");
	const [searchKeyword, setSearchKeyword] = useState("");
	const [editor, setEditor] = useState({ question: "", answer: "", evidence: "", reasoning: "" });
	const [historyOpen, setHistoryOpen] = useState(false);
	const [history, setHistory] = useState<WorkflowHistoryEntry[]>([]);
	const [analysisCollapseOpen, setAnalysisCollapseOpen] = useState(false);
	// 左右栏可拖拽宽度 (中栏 flex:1 自适应)
	const [leftWidth, setLeftWidth] = useState(240);
	const [rightWidth, setRightWidth] = useState(400);
	const clampLeft = (w: number) => Math.min(480, Math.max(180, w));
	const clampRight = (w: number) => Math.min(700, Math.max(300, w));

	// —— 图片框选 ——
	const imageRef = useRef<HTMLImageElement>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [imageRegionLabel, setImageRegionLabel] = useState(DEFAULT_IMAGE_REGION_LABEL);
	const imgSel = useImageSelection(imageRef);
	const { imageSelection, dragSelection } = imgSel;

	// —— 视频帧抓取 ——
	const videoRef = useRef<HTMLVideoElement>(null);
	const [videoCurrentTime, setVideoCurrentTime] = useState(0);
	const [videoDuration, setVideoDuration] = useState(0);
	const [videoWindow, setVideoWindow] = useState<VideoWindowState>({ start: null, end: null, sampleCount: 3, trajectoryLabel: DEFAULT_VIDEO_TRAJECTORY_LABEL, startFrame: null, endFrame: null });
	const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null);
	const videoCap = useVideoCapture(videoRef);

	// —— 多模态分析结果 + 历史 ——
	const [detailAnalysis, setDetailAnalysis] = useState<DetailAnalysis | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([]);

	// 资产列表
	const assetsQuery = useQuery({ queryKey: ["ls-assets"], queryFn: fetchAssets });
	const assets = assetsQuery.data?.items ?? [];
	const filteredAssets = useMemo(() => {
		const byType = assetTypeFilter === "all" ? assets : assets.filter(a => a.data_type === assetTypeFilter);
		const kw = searchKeyword.trim().toLowerCase();
		return kw ? byType.filter(a => a.name.toLowerCase().includes(kw)) : byType;
	}, [assets, assetTypeFilter, searchKeyword]);
	const selectedAsset = assets.find(a => a.id === selectedAssetId) ?? null;

	// QA 列表 (按资产)
	const qaQuery = useQuery({
		queryKey: ["ls-qa-asset", selectedAssetId],
		queryFn: () => (selectedAssetId ? listQAByAsset(selectedAssetId) : Promise.resolve({ items: [] as QAItem[], total: 0 })),
		enabled: !!selectedAssetId,
	});
	const qaItems = qaQuery.data?.items ?? [];
	const selectedQa = qaItems.find(q => q.id === selectedQaId) ?? null;

	// QA 详情
	const qaDetailQuery = useQuery({
		queryKey: ["ls-qa-detail", selectedQaId],
		queryFn: () => (selectedQaId ? fetchQAItem(selectedQaId) : Promise.resolve(null)),
		enabled: !!selectedQaId,
	});
	const qaDetail = qaDetailQuery.data ?? null;

	useEffect(() => {
		if (qaDetail)
			setEditor({ question: qaDetail.question || "", answer: qaDetail.answer || "", evidence: qaDetail.evidence || "", reasoning: qaDetail.reasoning || "" });
	}, [qaDetail]);

	// 自动选中
	useEffect(() => {
		if (!selectedAssetId && filteredAssets.length > 0)
			setSelectedAssetId(filteredAssets[0].id);
	}, [filteredAssets, selectedAssetId]);
	useEffect(() => {
		if (!selectedQaId && qaItems.length > 0)
			setSelectedQaId(qaItems[0].id);
	}, [qaItems, selectedQaId]);

	// 资产预览 (切换资产重置所有交互状态)
	useAssetPreview(selectedAsset, setPreviewUrl, () => imgSel.clear(), setVideoWindow, setDetailAnalysis, setCapturedFrameUrl);

	const qaSummary = useMemo(() => ({
		green: qaItems.filter(i => i.score_bucket === "green").length,
		orange: qaItems.filter(i => i.score_bucket === "orange").length,
		red: qaItems.filter(i => i.score_bucket === "red").length,
		pending: qaItems.filter(i => isPendingReview(i.status)).length,
		approved: qaItems.filter(i => isReviewedOk(i.status)).length,
	}), [qaItems]);
	const recommendation = getRecommendation(qaDetail ?? selectedQa);

	const { genMutation, saveMutation, submitMutation, reviewMutation, finalizeMutation, uploadMutation, finalizeAnalysisMutation } = useAnnotationMutations({ selectedAssetId, selectedQaId, assets });

	const addHistory = (analysis: DetailAnalysis, label: string) => {
		const entry: AnalysisHistoryEntry = {
			id: (crypto.randomUUID?.() ?? `h${Date.now()}-${Math.random()}`),
			label,
			analysis,
			saved: false,
			createdAt: Date.now(),
		};
		setAnalysisHistory(prev => [entry, ...prev].slice(0, 10));
	};

	const loadHistory = async () => {
		if (!selectedQaId)
			return;
		try {
			const d = await qaItemWorkflowHistory(selectedQaId);
			setHistory(d.items || []);
			setHistoryOpen(true);
		}
		catch { window.$message?.error("加载流程历史失败"); }
	};

	// —— 图片区域分析 ——
	const analyzeSelectedRegion = async () => {
		if (!selectedAsset?.id || !imageSelection) {
			window.$message?.warning("请先在图片上拖拽框选一个区域");
			return;
		}
		setDetailLoading(true);
		try {
			const b64 = imgSel.cropToBase64();
			if (!b64)
				throw new Error("裁剪区域失败");
			const data = await analyzeRegion({ asset_id: selectedAsset.id, image_base64: b64, region_label: imageRegionLabel });
			setDetailAnalysis({ type: "image", ...data } as DetailAnalysis);
			addHistory({ type: "image", ...data } as DetailAnalysis, `图片·${imageRegionLabel}`);
			setAnalysisCollapseOpen(true);
			window.$message?.success("区域标注分析已完成");
		}
		catch (err: unknown) {
			window.$message?.error((err instanceof Error ? err.message : String(err)) || "区域标注分析失败");
		}
		finally { setDetailLoading(false); }
	};

	// —— 视频关键帧分析 ——
	const analyzeCurrentFrame = async () => {
		if (!selectedAsset?.id)
			return;
		setDetailLoading(true);
		try {
			const result = await videoCap.analyzeFrame(selectedAsset.id);
			if (result) {
				setCapturedFrameUrl(result.dataUrl);
				const detail = { type: "video", previewUrl: result.dataUrl, ...result.data } as DetailAnalysis;
				setDetailAnalysis(detail);
				addHistory(detail, `关键帧·${formatTimestampTag(result.timestamp)}`);
				setAnalysisCollapseOpen(true);
				window.$message?.success("关键帧标注分析已完成");
			}
		}
		catch (err: unknown) {
			window.$message?.error((err instanceof Error ? err.message : String(err)) || "关键帧标注分析失败");
		}
		finally { setDetailLoading(false); }
	};

	// —— 视频时间窗分析 (基于 Slider 区间) ——
	const handleAnalyzeVideoWindow = async () => {
		if (!selectedAsset?.id || videoWindow.start == null || videoWindow.end == null) {
			window.$message?.warning("请先用滑块选择时间区间");
			return;
		}
		const timestamps = buildWindowSampleTimestamps(videoWindow.start, videoWindow.end, videoWindow.sampleCount);
		setDetailLoading(true);
		try {
			const result = await videoCap.analyzeWindow(selectedAsset.id, timestamps, videoWindow.trajectoryLabel, videoWindow.start, videoWindow.end);
			const detail = { type: "video-window", framePreviews: result.framePreviews, ...result.data } as DetailAnalysis;
			setDetailAnalysis(detail);
			addHistory(detail, `时间窗·${result.data.frame_entries?.length ?? timestamps.length}帧`);
			setAnalysisCollapseOpen(true);
			window.$message?.success("时间窗分析已完成");
		}
		catch (err: unknown) {
			window.$message?.error((err instanceof Error ? err.message : String(err)) || "时间窗分析失败");
		}
		finally { setDetailLoading(false); }
	};

	// —— 落库多模态分析结果为标注项 ——
	const saveAnalysis = async (entry?: AnalysisHistoryEntry) => {
		const target = entry ?? (detailAnalysis ? { id: "current", label: "当前结果", analysis: detailAnalysis, saved: false, createdAt: Date.now() } : null);
		if (!target?.analysis)
			return;
		try {
			await finalizeAnalysisMutation.mutateAsync(target.analysis);
			if (entry)
				setAnalysisHistory(prev => prev.map(h => h.id === entry.id ? { ...h, saved: true } : h));
		}
		catch { /* onError 已提示 */ }
	};

	const subBg = token.colorFillQuaternary;

	// ============================================================
	// 分析结果面板 (文本/图片/视频统一) — 内联在预览区底部
	// ============================================================
	const renderDetailAnalysisPanel = () => {
		if (!detailAnalysis)
			return null;
		return (
			<Card
				size="small"
				title={(
					<Space size={6}>
						<ScissorOutlined />
						多模态分析结果
					</Space>
				)}
				variant="borderless"
				style={{ background: subBg, marginTop: 12 }}
				extra={(
					<Button
						type="primary"
						size="small"
						icon={<SaveOutlined />}
						loading={finalizeAnalysisMutation.isPending}
						onClick={() => saveAnalysis()}
					>
						保存为标注项
					</Button>
				)}
			>
				<Row gutter={12}>
					<Col span={8}>
						<Statistic
							title="置信度"
							value={detailAnalysis.score ?? 0}
							suffix="分"
							styles={{ content: { color: BUCKET_COLOR[detailAnalysis.bucket] === "green" ? token.colorSuccess : BUCKET_COLOR[detailAnalysis.bucket] === "orange" ? token.colorWarning : token.colorError, fontSize: 20 } }}
						/>
						<Tag color={BUCKET_COLOR[detailAnalysis.bucket]} className="mt-1">{BUCKET_TITLE[detailAnalysis.bucket] || detailAnalysis.bucket}</Tag>
					</Col>
					<Col span={16}>
						{detailAnalysis.type === "image" && (
							<>
								<Text strong>区域分析：</Text>
								<Paragraph className="mt-1">{detailAnalysis.answer || "（无）"}</Paragraph>
								<VoteDetailsPanel votes={"votes" in detailAnalysis ? detailAnalysis.votes : undefined} similarityMode={"similarity_mode" in detailAnalysis ? String(detailAnalysis.similarity_mode) : undefined} agreementScore={(detailAnalysis as RegionAnalysisResult).agreement_score} candidateModels={"candidate_models" in detailAnalysis ? detailAnalysis.candidate_models : undefined} />
							</>
						)}
						{detailAnalysis.type === "video" && (
							<>
								<img src={detailAnalysis.previewUrl} alt="frame" style={{ width: "100%", maxHeight: 140, objectFit: "contain", borderRadius: 6, marginBottom: 8 }} />
								<Text strong>关键帧分析：</Text>
								<Paragraph className="mt-1">{detailAnalysis.answer || "（无）"}</Paragraph>
								<VoteDetailsPanel votes={"votes" in detailAnalysis ? detailAnalysis.votes : undefined} similarityMode={"similarity_mode" in detailAnalysis ? String(detailAnalysis.similarity_mode) : undefined} agreementScore={(detailAnalysis as VideoFrameAnalysisResult).agreement_score} candidateModels={"candidate_models" in detailAnalysis ? detailAnalysis.candidate_models : undefined} />
							</>
						)}
						{detailAnalysis.type === "video-window" && (
							<>
								<Text strong>
									时间窗分析（
									{(detailAnalysis as VideoWindowAnalysisResult).frame_entries?.length ?? 0}
									帧）：
								</Text>
								<Paragraph className="mt-1">{detailAnalysis.answer || "（无）"}</Paragraph>
								<Row gutter={6} className="mt-2">
									{detailAnalysis.framePreviews?.map(fp => (
										<Col key={fp.timestamp} span={8}>
											<img src={fp.dataUrl} alt={`frame-${fp.timestamp}`} style={{ width: "100%", borderRadius: 4 }} />
											<Text type="secondary" style={{ fontSize: 10 }}>
												{fp.timestamp.toFixed(1)}
												s
											</Text>
										</Col>
									))}
								</Row>
								{detailAnalysis.frame_entries && detailAnalysis.frame_entries.length > 0 && (
									<Timeline
										className="mt-2"
										items={detailAnalysis.frame_entries.map((f, i) => ({
											color: BUCKET_COLOR[f.bucket] || "gray",
											children: (
												<div>
													<Text strong>
														帧
														{i + 1}
														(
														{f.timestamp?.toFixed(1)}
														s):
														{" "}
													</Text>
													<Tag color={f.bucket}>
														{f.score?.toFixed(1)}
														分
													</Tag>
													<br />
													<Text type="secondary" className="text-xs">{f.answer || f.description || "（无描述）"}</Text>
												</div>
											),
										}))}
									/>
								)}
							</>
						)}
					</Col>
				</Row>
			</Card>
		);
	};

	// ============================================================
	// 内容预览 + 标注操作 (按资产类型切换) — 中栏主体, 内部自由滚动
	// ============================================================
	const renderAnnotationStage = () => {
		if (!selectedAsset)
			return <Alert type="info" message="请选择左侧资料" description="从左侧选择一份文本、图片或视频资料，即可开始标注。" showIcon />;

		// 文本
		if (selectedAsset.data_type === "text") {
			return (
				<Space direction="vertical" size={12} className="w-full">
					<Space wrap>
						<FileTextOutlined style={{ color: token.colorPrimary }} />
						<Text strong>文档预览</Text>
						<Button type="primary" icon={<ThunderboltOutlined />} loading={genMutation.isPending} onClick={() => selectedAssetId && genMutation.mutate(selectedAssetId)}>
							生成智能评估 (GLM+Qwen 双模型)
						</Button>
					</Space>
					<div style={{ background: subBg, borderRadius: token.borderRadius, padding: "16px 18px", border: `1px solid ${token.colorBorderSecondary}` }}>
						<MarkdownView content={(selectedAsset.normalized_markdown || "（无解析内容）").slice(0, 8000)} />
						{(selectedAsset.normalized_markdown || "").length > 8000 && (
							<Text type="secondary">
								{"\n\u2026\u2026\u5171"}
								{(selectedAsset.normalized_markdown || "").length}
								{"\u5B57\u7B26\uFF0C\u5DF2\u622A\u65AD\u663E\u793A\uFF09"}
							</Text>
						)}
					</div>
				</Space>
			);
		}

		// 图片: overlay 框选 + 区域标签
		if (selectedAsset.data_type === "image" && previewUrl) {
			const active = dragSelection || imageSelection;
			return (
				<Space direction="vertical" size={12} className="w-full">
					<Space wrap>
						<Text type="secondary">区域标签:</Text>
						<Select
							showSearch
							value={imageRegionLabel}
							onChange={setImageRegionLabel}
							style={{ width: 180 }}
							options={IMAGE_REGION_LABELS.map(l => ({ value: l, label: l }))}
							placeholder="选择区域标签"
							filterOption={(input, option) => (option?.label ?? "").includes(input)}
						/>
						<Button type="primary" icon={<ScissorOutlined />} onClick={analyzeSelectedRegion} loading={detailLoading} disabled={!imageSelection}>裁剪并分析框选区域</Button>
						<Button size="small" onClick={imgSel.selectCenter} disabled={!previewUrl}>选择中心区域</Button>
						<Button size="small" onClick={imgSel.clear} disabled={!imageSelection}>清除框选</Button>
						{imageSelection && (
							<Text type="secondary">
								框选:
								{Math.round(imageSelection.width)}
								×
								{Math.round(imageSelection.height)}
								px
							</Text>
						)}
					</Space>
					<div style={{ display: "flex", justifyContent: "center" }}>
						<div style={{ position: "relative", display: "inline-block", lineHeight: 0, maxWidth: "100%" }}>
							{/* 只约束 max 尺寸, 不强制 width/height → 浏览器始终按原始宽高比缩放, 不变形; 放大显示框提升清晰度 */}
							<img ref={imageRef} src={previewUrl} alt={selectedAsset.name} style={{ maxWidth: "100%", maxHeight: 560, height: "auto", width: "auto", borderRadius: 8, display: "block" }} />
							<div style={{ position: "absolute", inset: 0, cursor: "crosshair", borderRadius: 8 }} onMouseDown={imgSel.handleStart} onMouseMove={imgSel.handleMove} onMouseUp={imgSel.handleEnd} onMouseLeave={imgSel.handleEnd} />
							{active && (
								<div style={{ position: "absolute", left: active.left, top: active.top, width: active.width, height: active.height, border: `2px solid ${token.colorPrimary}`, background: hexToRgba(token.colorPrimary, 0.18), borderRadius: 4, pointerEvents: "none", boxShadow: "0 0 0 1px rgba(255,255,255,0.65) inset" }} />
							)}
						</div>
					</div>
					{!imageSelection && <Text type="secondary" className="text-xs">在图片上拖拽鼠标画框，框选需要精标的区域，点击「裁剪并分析框选区域」自动裁剪并送多模型分析</Text>}
				</Space>
			);
		}

		// 视频: Slider 时间区间 + 抽帧
		if (selectedAsset.data_type === "video" && previewUrl) {
			const dur = videoDuration || 10;
			return (
				<Space direction="vertical" size={12} className="w-full">
					<video
						ref={videoRef}
						src={previewUrl}
						controls
						style={{ width: "100%", maxHeight: 420, borderRadius: 8 }}
						onLoadedMetadata={(e) => {
							const d = e.currentTarget.duration;
							if (d && Number.isFinite(d)) {
								setVideoDuration(d);
								setVideoWindow(p => ({ ...p, start: p.start ?? 0, end: p.end ?? d }));
							}
						}}
						onTimeUpdate={e => setVideoCurrentTime(e.currentTarget.currentTime || 0)}
					/>
					<Space wrap>
						<Tag color="cyan">
							当前:
							{videoCurrentTime.toFixed(3)}
							s
						</Tag>
						<Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={analyzeCurrentFrame} loading={detailLoading}>分析当前关键帧</Button>
					</Space>
					<Card
						size="small"
						type="inner"
						title={(
							<Space size={6}>
								<ScanOutlined />
								时间区间 / 轨迹级标注
							</Space>
						)}
					>
						<Space direction="vertical" size={10} className="w-full">
							<Slider
								range
								min={0}
								max={dur}
								step={0.1}
								value={[videoWindow.start ?? 0, videoWindow.end ?? dur]}
								onChange={v => setVideoWindow(p => ({ ...p, start: v[0], end: v[1] }))}
							/>
							<Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
								<Text type="secondary">
									区间:
									{(videoWindow.start ?? 0).toFixed(1)}
									s ~
									{(videoWindow.end ?? dur).toFixed(1)}
									s（
									{((videoWindow.end ?? dur) - (videoWindow.start ?? 0)).toFixed(1)}
									s）
								</Text>
								<Space>
									<Text>采样帧:</Text>
									<InputNumber min={2} max={6} value={videoWindow.sampleCount} onChange={v => setVideoWindow(p => ({ ...p, sampleCount: v || 3 }))} size="small" />
									<AutoComplete placeholder="轨迹标签" value={videoWindow.trajectoryLabel} onChange={v => setVideoWindow(p => ({ ...p, trajectoryLabel: v }))} options={VIDEO_TRAJECTORY_LABELS.map(l => ({ value: l }))} filterOption={(input, option) => (option?.value ?? "").includes(input)} style={{ width: 180 }} size="small" />
								</Space>
							</Space>
							<Button type="primary" icon={<PlayCircleOutlined />} onClick={handleAnalyzeVideoWindow} loading={detailLoading} disabled={videoWindow.start == null || videoWindow.end == null}>
								区间抽
								{videoWindow.sampleCount}
								帧并分析
							</Button>
						</Space>
					</Card>
					{capturedFrameUrl && !detailAnalysis && <img src={capturedFrameUrl} alt="captured" style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 8, background: subBg }} />}
				</Space>
			);
		}

		// 图片/视频但预览未加载
		if ((selectedAsset.data_type === "image" || selectedAsset.data_type === "video") && !previewUrl)
			return <Alert type="warning" message="预览加载中…" description="若长时间无显示，请确认资料文件可正常读取。" showIcon />;
		return <Paragraph type="secondary">{ASSET_TYPE_LABEL[selectedAsset.data_type] || selectedAsset.data_type}</Paragraph>;
	};

	const assetIcon = (t: string) => t === "image" ? <PictureOutlined style={{ color: token.colorPrimary }} /> : t === "video" ? <VideoCameraOutlined style={{ color: token.colorWarning }} /> : <FileTextOutlined style={{ color: token.colorPrimary }} />;

	const stats = [
		{ title: "资料", value: assets.length, c: token.colorTextBase, help: "全部上传的数据资料" },
		{ title: "标注项", value: qaItems.length, c: token.colorTextBase, help: "当前所选资料的标注项" },
		{ title: "红桶", value: qaSummary.red, c: token.colorError, help: "置信度低于阈值的低质量标注项" },
		{ title: "待审核", value: qaSummary.pending, c: token.colorWarning, help: "状态为待审核的标注项" },
	];

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 8 }}>
			{/* —— 顶栏: 标题 + 统计 + 工具 (紧凑, 固定不滚动) —— */}
			<div style={{ flex: "none", background: token.colorPrimaryBg, borderRadius: token.borderRadiusLG, padding: "10px 16px" }}>
				<Row gutter={[16, 10]} align="middle">
					<Col flex="auto">
						<Space size={8} wrap>
							<Tag color="purple">数据标注</Tag>
							<Text strong style={{ fontSize: 15 }}>选资料 → 看内容 → 做标注 → 进审核</Text>
							{selectedAsset && (
								<Tag color="blue">
									{selectedAsset.name}
									{" "}
									·
									{ASSET_TYPE_LABEL[selectedAsset.data_type] || selectedAsset.data_type}
								</Tag>
							)}
						</Space>
					</Col>
					<Col flex="none">
						<Space size={6} wrap>
							{stats.map(m => (
								<Tooltip key={m.title} title={m.help}>
									<span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", padding: "0 10px", borderRight: `1px solid ${token.colorBorderSecondary}` }}>
										<span style={{ fontSize: 11, color: token.colorTextSecondary }}>{m.title}</span>
										<span style={{ fontSize: 18, fontWeight: 600, color: m.c, lineHeight: 1.2 }}>{m.value}</span>
									</span>
								</Tooltip>
							))}
						</Space>
					</Col>
				</Row>
				<Row gutter={[8, 8]} style={{ marginTop: 8 }} align="middle">
					<Col flex="auto">
						<Space size={6} wrap>
							<Upload
								accept=".txt,.md,.pdf,.docx,.xlsx,.csv,.json,.yaml,.html,image/*,video/*"
								showUploadList={false}
								beforeUpload={(file) => {
									uploadMutation.mutate({ file, name: file.name });
									return false;
								}}
							>
								<Button size="small" icon={<InboxOutlined />} loading={uploadMutation.isPending}>上传资料</Button>
							</Upload>
							<Button size="small" icon={<ReloadOutlined />} onClick={() => assetsQuery.refetch()}>刷新</Button>
							<Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} loading={genMutation.isPending} disabled={!selectedAsset || selectedAsset.data_type !== "text"} onClick={() => selectedAssetId && genMutation.mutate(selectedAssetId)}>生成智能评估</Button>
						</Space>
					</Col>
					<Col flex="none">
						{/* 分桶汇总 (紧凑内联, 不占独立大块) */}
						<Space size={4}>
							{[
								{ label: "绿", value: qaSummary.green, c: token.colorSuccess },
								{ label: "橙", value: qaSummary.orange, c: token.colorWarning },
								{ label: "红", value: qaSummary.red, c: token.colorError },
								{ label: "待审", value: qaSummary.pending, c: token.colorInfo },
								{ label: "通过", value: qaSummary.approved, c: token.colorTextBase },
							].map(m => (
								<Tag key={m.label} style={{ marginInlineEnd: 0 }}>
									<span style={{ color: token.colorTextSecondary }}>{m.label}</span>
									{" "}
									<span style={{ color: m.c, fontWeight: 600 }}>{m.value}</span>
								</Tag>
							))}
							{analysisHistory.length > 0 && (
								<Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => setAnalysisCollapseOpen(o => !o)}>
									历史(
									{analysisHistory.length}
									)
								</Button>
							)}
						</Space>
					</Col>
				</Row>
			</div>

			{/* —— 三栏工作区 (填满剩余视口高度, 各栏内部独立滚动) —— */}
			<div style={{ flex: 1, minHeight: 0, display: "flex" }}>
				{/* 左: 资料列表 */}
				<div style={{ width: leftWidth, flexShrink: 0, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
					<Panel
						title={`资料（${filteredAssets.length}）`}
						icon={<DatabaseOutlined />}
						fill
						bodyStyle={{ padding: 0 }}
					>
						<div style={{ padding: 8, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: "flex", flexDirection: "column", gap: 6 }}>
							<Input prefix={<SearchOutlined />} placeholder="搜索资料名" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} allowClear size="small" />
							<Segmented block value={assetTypeFilter} onChange={v => setAssetTypeFilter(String(v))} size="small" options={[{ value: "all", label: "全部" }, { value: "text", label: "文本" }, { value: "image", label: "图片" }, { value: "video", label: "视频" }]} />
						</div>
						<div style={{ overflowY: "auto", flex: 1 }}>
							{assetsQuery.isLoading
								? <div style={{ textAlign: "center", padding: 24, color: token.colorTextTertiary }}>加载中…</div>
								: filteredAssets.length === 0
									? <Empty description="暂无资料，请上传" style={{ marginTop: 32 }} />
									: filteredAssets.map(item => (
										<div
											key={item.id}
											onClick={() => {
												setSelectedAssetId(item.id);
												setSelectedQaId(null);
											}}
											style={{ cursor: "pointer", background: selectedAssetId === item.id ? token.colorPrimaryBg : "transparent", borderRadius: token.borderRadius, padding: "8px 10px", margin: "4px 6px", display: "flex", gap: 8, alignItems: "flex-start", borderLeft: selectedAssetId === item.id ? `3px solid ${token.colorPrimary}` : "3px solid transparent", transition: "all 0.2s" }}
										>
											<span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>{assetIcon(item.data_type)}</span>
											<div style={{ flex: 1, minWidth: 0 }}>
												<Text ellipsis style={{ maxWidth: 150, display: "block", fontSize: 13 }}>{item.name}</Text>
												<Space size={4} wrap style={{ marginTop: 2 }}>
													<Tag style={{ marginInlineEnd: 0, fontSize: 11 }}>{ASSET_TYPE_LABEL[item.data_type] || item.data_type}</Tag>
													<Tag color={item.status === "approved" || isReviewedOk(item.status) ? "green" : isPendingReview(item.status) ? "orange" : "blue"} style={{ marginInlineEnd: 0, fontSize: 11 }}>{STATUS_LABEL[item.status] || item.status}</Tag>
												</Space>
											</div>
										</div>
									))}
						</div>
					</Panel>
				</div>

				<VSplitter token={token} onDrag={d => setLeftWidth(w => clampLeft(w + d))} />

				{/* 中: 预览 + 标注操作 (独立滚动) */}
				<div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
					<Panel
						title="内容预览 / 标注操作"
						icon={<FileTextOutlined style={{ color: token.colorPrimary }} />}
						fill
						bodyStyle={{ padding: 12 }}
					>
						{renderAnnotationStage()}
						{/* 分析结果 (图片/视频) 内联在预览区底部 */}
						{renderDetailAnalysisPanel()}
					</Panel>
				</div>

				<VSplitter token={token} onDrag={d => setRightWidth(w => clampRight(w - d))} />

				{/* 右: 标注项列表 + 单条处理 (上下分栏, 各自滚动) */}
				<div style={{ width: rightWidth, flexShrink: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
					{/* 标注项列表 (上半, 占 40%) */}
					<div style={{ flex: "0 0 40%", minHeight: 0, minWidth: 0, width: "100%", display: "flex" }}>
						<Panel
							title={`标注项（${qaItems.length}）`}
							icon={<DatabaseOutlined />}
							fill
							bodyStyle={{ padding: 0 }}
						>
							{qaQuery.isLoading
								? <div style={{ textAlign: "center", padding: 24, color: token.colorTextTertiary }}>加载中…</div>
								: qaItems.length === 0
									? <Empty description="还没有标注项，对资料做标注后会出现在这里" style={{ marginTop: 32 }} />
									: qaItems.map((item) => {
										const rec = getRecommendation(item);
										return (
											<div key={item.id} onClick={() => setSelectedQaId(item.id)} style={{ cursor: "pointer", background: selectedQaId === item.id ? token.colorPrimaryBg : "transparent", borderRadius: token.borderRadius, padding: "8px 10px", margin: "4px 6px", border: selectedQaId === item.id ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`, transition: "all 0.2s" }}>
												<Space direction="vertical" size={2} className="w-full">
													<Text strong ellipsis className="max-w-full" style={{ fontSize: 13, minWidth: 0 }}>{item.question || `标注项 ${item.id.slice(0, 8)}`}</Text>
													<Text type="secondary" ellipsis style={{ maxWidth: "100%", minWidth: 0, fontSize: 12 }}>{previewText(item.answer, item.evidence, item.reasoning)}</Text>
													<Space size={4} wrap>
														<Tag color={BUCKET_COLOR[item.score_bucket]} style={{ marginInlineEnd: 0 }}>{BUCKET_TITLE[item.score_bucket] || item.score_bucket}</Tag>
														<Tag style={{ marginInlineEnd: 0 }}>
															{Math.round(item.confidence)}
															{" "}
															分
														</Tag>
														<Text type="secondary" className="text-[11px]">{rec.label}</Text>
													</Space>
												</Space>
											</div>
										);
									})}
						</Panel>
					</div>

					{/* 单条标注处理 (下半, 占 60%) */}
					<div style={{ flex: "1 1 0", minHeight: 0, minWidth: 0, width: "100%", display: "flex" }}>
						<Panel
							title={qaDetail ? "单条标注处理" : "单条标注处理"}
							icon={<EditOutlined style={{ color: token.colorPrimary }} />}
							fill
							extra={qaDetail ? <Button type="text" icon={<HistoryOutlined />} onClick={loadHistory} size="small">历史</Button> : undefined}
							bodyStyle={{ padding: 10 }}
						>
							{qaDetail
								? (
									<Space direction="vertical" size={10} className="w-full">
										<Space wrap size={4}>
											<Tag color={BUCKET_COLOR[qaDetail.score_bucket]}>{BUCKET_TITLE[qaDetail.score_bucket]}</Tag>
											<Tag color={qaDetail.status === "approved" || isReviewedOk(qaDetail.status) ? "green" : isPendingReview(qaDetail.status) ? "orange" : "blue"}>{STATUS_LABEL[qaDetail.status] || qaDetail.status}</Tag>
											<Tag>
												{Math.round(qaDetail.confidence)}
												{" "}
												分
											</Tag>
											{(qaDetail.candidate_models || []).map(m => <Tag color="blue" key={m}>{m}</Tag>)}
										</Space>
										<div>
											<Text strong style={{ fontSize: 13 }}>问题</Text>
											<Input value={editor.question} onChange={e => setEditor(p => ({ ...p, question: e.target.value }))} className="mt-1" size="small" />
										</div>
										<div>
											<Text strong style={{ fontSize: 13 }}>答案</Text>
											<TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={editor.answer} onChange={e => setEditor(p => ({ ...p, answer: e.target.value }))} className="mt-1" />
										</div>
										<div>
											<Text strong style={{ fontSize: 13 }}>证据</Text>
											<TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={editor.evidence} onChange={e => setEditor(p => ({ ...p, evidence: e.target.value }))} className="mt-1" />
										</div>
										<div>
											<Text strong style={{ fontSize: 13 }}>推理链</Text>
											<TextArea autoSize={{ minRows: 2, maxRows: 5 }} value={editor.reasoning} onChange={e => setEditor(p => ({ ...p, reasoning: e.target.value }))} className="mt-1" />
										</div>
										{(qaDetail?.votes?.length ?? 0) > 0 && (
											<Card size="small" title="多模型对比" variant="borderless" style={{ background: subBg }}>
												<Space direction="vertical" size={6} className="w-full">
													{(qaDetail?.votes ?? []).map((vote, i) => (
														<Card key={vote.model_alias || i} size="small" type="inner" title={vote.model_alias}>
															<Paragraph className="mb-1" style={{ fontSize: 12 }}>
																<Text strong>答案：</Text>
																{(vote.answer || "").slice(0, 100)}
															</Paragraph>
															<Paragraph className="mb-0" style={{ fontSize: 12 }}>
																<Text strong>证据：</Text>
																{(vote.evidence || "—").slice(0, 80)}
															</Paragraph>
														</Card>
													))}
												</Space>
											</Card>
										)}
										<Alert type={recommendation.tone === "green" ? "success" : recommendation.tone === "red" ? "error" : recommendation.tone === "orange" ? "warning" : "info"} message={recommendation.label} description={recommendation.description} showIcon />
										<Space wrap size={6}>
											<Button type="primary" size="small" icon={<EditOutlined />} loading={saveMutation.isPending} onClick={() => selectedQaId && saveMutation.mutate({ id: selectedQaId, payload: editor })}>保存修订</Button>
											<Button type="primary" ghost size="small" icon={<CheckCircleOutlined />} loading={finalizeMutation.isPending} onClick={() => selectedQaId && finalizeMutation.mutate({ id: selectedQaId, status: qaDetail.status })}>定稿</Button>
											<Button size="small" icon={<CheckCircleOutlined />} loading={submitMutation.isPending} disabled={isPendingReview(qaDetail.status) || isReviewedOk(qaDetail.status)} onClick={() => selectedQaId && submitMutation.mutate(selectedQaId)}>提交审核</Button>
											{isPendingReview(qaDetail.status) && (
												<>
													<Button type="primary" ghost size="small" icon={<CheckCircleOutlined />} loading={reviewMutation.isPending} onClick={() => selectedQaId && reviewMutation.mutate({ id: selectedQaId, approved: true })}>通过</Button>
													<Button danger size="small" icon={<CloseCircleOutlined />} loading={reviewMutation.isPending} onClick={() => selectedQaId && reviewMutation.mutate({ id: selectedQaId, approved: false })}>驳回</Button>
												</>
											)}
										</Space>
									</Space>
								)
								: <Empty description="请从上方选择标注项" style={{ marginTop: 40 }} />}
						</Panel>
					</div>
				</div>
			</div>

			{/* 分析历史 Drawer (按需弹出, 不占主工作区) */}
			<Drawer
				title="分析历史"
				open={analysisCollapseOpen}
				onClose={() => setAnalysisCollapseOpen(false)}
				width={480}
			>
				{analysisHistory.length === 0
					? <Empty description="暂无分析记录" />
					: (
						<Row gutter={[12, 12]}>
							{analysisHistory.map((h) => {
								const b = h.analysis.bucket;
								return (
									<Col key={h.id} xs={24} sm={12}>
										<Card size="small" style={{ borderLeft: `4px solid ${b === "green" ? token.colorSuccess : b === "orange" ? token.colorWarning : token.colorError}` }}>
											<Space direction="vertical" size={4} className="w-full">
												<Space style={{ width: "100%", justifyContent: "space-between" }}>
													<Text strong ellipsis style={{ maxWidth: 140 }}>{h.label}</Text>
													<Tag color={BUCKET_COLOR[b]}>{BUCKET_TITLE[b]}</Tag>
												</Space>
												<Text type="secondary" className="text-xs">{(h.analysis.answer || h.analysis.question || "（无）").slice(0, 50)}</Text>
												<Space size={6}>
													<Statistic value={h.analysis.score} suffix="分" valueStyle={{ color: b === "green" ? token.colorSuccess : b === "orange" ? token.colorWarning : token.colorError, fontSize: 16 }} />
													{h.saved
														? <Tag color="success" icon={<CheckCircleOutlined />}>已入库</Tag>
														: <Button size="small" type="primary" ghost icon={<DatabaseOutlined />} loading={finalizeAnalysisMutation.isPending} onClick={() => saveAnalysis(h)}>存为标注项</Button>}
												</Space>
											</Space>
										</Card>
									</Col>
								);
							})}
						</Row>
					)}
			</Drawer>

			{/* 流程历史 Drawer */}
			<Drawer title="标注项流程历史" open={historyOpen} onClose={() => setHistoryOpen(false)} width={520}>
				{history.length === 0
					? <Empty description="暂无流程记录" />
					: history.map(item => (
						<div key={item.id} style={{ padding: "12px 0", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
							<Text strong>{`${item.action} · ${STATUS_LABEL[item.status] || item.status}`}</Text>
							<div><Text type="secondary" className="text-xs">{(item.created_at || "") + (item.comment ? ` · ${item.comment}` : "")}</Text></div>
						</div>
					))}
			</Drawer>
		</div>
	);
}
