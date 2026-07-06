// data-annotation 本地类型
// 三模态统一标注工作台的选区/视频窗/分析结果类型 + 分析历史
import type { RegionAnalysisResult, VideoFrameAnalysisResult, VideoWindowAnalysisResult } from "#src/api/label-system";

export interface ImageSelection {
	left: number
	top: number
	width: number
	height: number
	normalized: { x: number, y: number, width: number, height: number }
}

export interface FramePoint {
	timestamp: number
	dataUrl: string
	base64: string
}

export interface VideoWindowState {
	start: number | null
	end: number | null
	sampleCount: number
	trajectoryLabel: string
	startFrame: FramePoint | null
	endFrame: FramePoint | null
}

// 拆为别名规避 indent-binary-ops 与 no-mixed-spaces-and-tabs 在多行 union 上的规则冲突
type ImageDetailAnalysis = { type: "image" } & RegionAnalysisResult;
type VideoFrameDetailAnalysis = { type: "video", previewUrl: string } & VideoFrameAnalysisResult;
type VideoWindowDetailAnalysis = { type: "video-window", framePreviews: Array<{ timestamp: number, dataUrl: string }> } & VideoWindowAnalysisResult;
export type DetailAnalysis = ImageDetailAnalysis | VideoFrameDetailAnalysis | VideoWindowDetailAnalysis;

// ★ 分析历史条目 (统一展示文本/图片/视频的多模态分析结果, 带落库状态)
export interface AnalysisHistoryEntry {
	id: string
	label: string // 显示标签: "文本·生成" / "图片·区域标签" / "关键帧" / "时间窗·N帧"
	analysis: DetailAnalysis
	saved: boolean // 是否已保存为标注项
	createdAt: number
}
