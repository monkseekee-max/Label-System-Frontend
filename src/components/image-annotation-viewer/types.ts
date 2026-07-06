import type { CSSProperties } from "react";

// ============================================================================
// 外部 JSON 格式（输入/输出契约）
// ============================================================================
// 这部分类型定义与后端 API 或文件存储中的标注数据格式一致。

/**
 * 单个标注形状（Shape）
 *
 * 对应一个矩形框选区域，包含标签、坐标、置信度等信息。
 * 该结构可直接序列化为 JSON，也可从 JSON 反序列化得到。
 */
export interface AnnotationShape {
	/** 形状的唯一标识，可选。若提供则用于保持编辑前后状态一致 */
	id?: string
	/** 标签名称，如 "person"、"bottle" */
	label: string
	/** 模型预测的置信度分数，如 0.907 */
	score?: number
	/**
	 * 矩形框的两个对角点坐标。
	 * 格式为 [[x1, y1], [x2, y2]]，其中 (x1,y1) 和 (x2,y2) 是对角线上的任意两个点。
	 * 组件内部会通过 `pointsToRect` 将其归一化为左上角 + 宽高。
	 */
	points: [[number, number], [number, number]]
	/** 形状类型，当前仅支持 "rectangle" */
	shape_type: "rectangle"
	/** 分组 ID，可用于将多个形状关联到同一组 */
	group_id: number | null
	/** 描述文本 */
	description: string | null
	/** 是否为困难样本 */
	difficult: boolean
	/** 附加标志 */
	flags: Record<string, unknown> | null
	/** 自定义属性 */
	attributes: Record<string, unknown>
	/** KIE（关键信息抽取）链接关系 */
	kie_linking: unknown[]
}

/**
 * 整张图片的标注数据
 *
 * 包含图片元信息和所有标注形状，是组件输入（annotations）和输出（onChange）的完整数据结构。
 */
export interface AnnotationData {
	/** 标注文件版本号 */
	version: string
	/** 附加标志 */
	flags: Record<string, unknown>
	/** 所有标注形状列表 */
	shapes: AnnotationShape[]
	/** 图片文件路径 */
	imagePath: string
	/** Base64 编码的图片数据，可选 */
	imageData: string | null
	/** 图片原始高度 */
	imageHeight: number
	/** 图片原始宽度 */
	imageWidth: number
}

// ============================================================================
// 内部表示
// ============================================================================
// 组件运行时使用的内部数据结构，相比外部格式更便于交互操作。

/**
 * 内部矩形（InternalRect）
 *
 * 将 AnnotationShape 中的 points 转换为便于计算和渲染的 {x, y, width, height} 形式。
 * 同时保留原始 shape 中的非核心字段（extra），以便在导出时无损还原。
 */
export interface InternalRect {
	/** 矩形唯一标识，用于 React key 和选中状态追踪 */
	id: string
	/** 显示序号，从 1 开始 */
	order: number
	/** 标签名称 */
	label: string
	/** 置信度分数 */
	score: number | undefined
	/** 矩形左上角在原始图片中的 x 坐标 */
	x: number
	/** 矩形左上角在原始图片中的 y 坐标 */
	y: number
	/** 矩形宽度 */
	width: number
	/** 矩形高度 */
	height: number
	/**
	 * 原始 shape 中除核心字段外的其他字段快照。
	 * 在将内部表示转换回外部 JSON 时，这些字段会被还原。
	 */
	extra: Omit<AnnotationShape, "label" | "score" | "points" | "shape_type">
}

// ============================================================================
// 交互状态
// ============================================================================
// 描述用户当前正在进行的操作类型及其上下文信息。

/** 绘制新矩形状态：记录起始点和当前鼠标位置 */
export interface DrawInteraction {
	type: "draw"
	start: { x: number, y: number }
	current: { x: number, y: number }
}

/** 移动已有矩形状态：记录起始拖拽点和矩形原始位置 */
export interface MoveInteraction {
	type: "move"
	rectId: string
	start: { x: number, y: number }
	origin: { x: number, y: number }
}

/**
 * 调整大小手柄方向。
 *
 * 每个字母代表一个边界：
 * - n = north（北/上）
 * - s = south（南/下）
 * - e = east（东/右）
 * - w = west（西/左）
 *
 * 组合如 "nw" 表示左上角手柄，"se" 表示右下角手柄。
 */
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** 调整矩形大小状态：记录手柄方向和矩形原始尺寸 */
export interface ResizeInteraction {
	type: "resize"
	rectId: string
	handle: ResizeHandle
	start: { x: number, y: number }
	origin: { x: number, y: number, width: number, height: number }
}

/**
 * 交互状态联合类型。
 *
 * 为 null 时表示用户未进行任何交互操作。
 */
export type InteractionState = DrawInteraction | MoveInteraction | ResizeInteraction | null;

// ============================================================================
// 组件 Props
// ============================================================================

/**
 * ImageAnnotationViewer 组件的属性。
 *
 * 该组件是一个图片标注查看器，支持在图片上绘制、移动、调整大小和删除矩形标注框。
 */
export interface ImageAnnotationViewerProps {
	/** 图片 URL，组件会异步加载该图片 */
	imageUrl: string
	/** 图片原始宽度。若未提供，则从加载的图片中自动获取 */
	imageWidth?: number
	/** 图片原始高度。若未提供，则从加载的图片中自动获取 */
	imageHeight?: number
	/**
	 * 标注数据。
	 * 当外部数据变化时，组件会重新解析并渲染矩形框。
	 * 若用户编辑了矩形框，会通过 onChange 回调通知父组件。
	 */
	annotations?: AnnotationData
	/** 是否禁用编辑。禁用后用户无法绘制、移动或调整矩形框 */
	disabled?: boolean
	/** 外层容器样式 */
	style?: CSSProperties
	/** 外层容器类名 */
	className?: string
	/**
	 * 标注数据变化回调。
	 * 当用户绘制、移动、调整大小、删除矩形框或修改标签时触发。
	 */
	onChange?: (data: AnnotationData) => void
	/**
	 * 选中矩形变化回调。
	 * 当用户点击某个矩形框使其被选中，或取消选中时触发。
	 * 参数为选中矩形的 id，若无选中则为 undefined。
	 */
	onSelect?: (rectId: string | undefined) => void
}
