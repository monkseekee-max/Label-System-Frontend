import type { AnnotationData, AnnotationShape, InternalRect } from "./types";

// ============================================================================
// 颜色调色板
// ============================================================================

/**
 * COCO 数据集风格的颜色调色板。
 *
 * 包含 40 种高对比度颜色，用于为不同的标签分配唯一的视觉颜色。
 * 同一标签名始终映射到同一颜色（通过哈希计算）。
 */
const COCO_PALETTE: string[] = [
	"#FF3838",
	"#FF9D00",
	"#FFC300",
	"#FFD700",
	"#B5FF00",
	"#00FF00",
	"#00FFB5",
	"#00D4FF",
	"#0099FF",
	"#0066FF",
	"#5B3EFF",
	"#9900FF",
	"#CC00FF",
	"#FF00FF",
	"#FF0066",
	"#FF6666",
	"#FFB366",
	"#FFCC66",
	"#99CC00",
	"#66CC00",
	"#33CC33",
	"#00CC99",
	"#00CCCC",
	"#3399CC",
	"#3366CC",
	"#6633CC",
	"#9933CC",
	"#CC33CC",
	"#CC3366",
	"#FF9999",
	"#FFB999",
	"#FFD699",
	"#CCFF99",
	"#99FF99",
	"#66FF99",
	"#33FFCC",
	"#00CCFF",
	"#6699FF",
	"#9966FF",
	"#CC66FF",
];

/** 标签颜色缓存，避免重复计算哈希 */
const labelColorCache = new Map<string, string>();

/**
 * 根据标签名获取对应的显示颜色。
 *
 * 使用字符串哈希算法将标签名映射到调色板中的固定颜色。
 * 同一标签名始终返回同一颜色，便于用户直观识别不同类别。
 *
 * @param label - 标签名称
 * @returns 十六进制颜色字符串，如 "#FF3838"
 */
export function getLabelColor(label: string | null | undefined): string {
	if (!label)
		return "#999999";

	const cached = labelColorCache.get(label);
	if (cached)
		return cached;

	// 计算标签名的哈希值（类似 Java 的 String.hashCode）
	let hash = 0;
	for (let i = 0; i < label.length; i++) {
		hash = ((hash << 5) - hash) + label.charCodeAt(i);
		hash |= 0;
	}
	const color = COCO_PALETTE[Math.abs(hash) % COCO_PALETTE.length];
	labelColorCache.set(label, color);
	return color;
}

// ============================================================================
// 坐标转换
// ============================================================================
// 外部 JSON 格式使用 points[[x1,y1],[x2,y2]] 存储矩形，
// 内部使用 {x, y, width, height} 存储，两者需要相互转换。

/**
 * 将 points 数组转换为矩形坐标对象。
 *
 * points 中两个点可以是任意对角点，函数会自动计算左上角和宽高。
 *
 * @param points - [[x1, y1], [x2, y2]] 对角点坐标
 * @returns {x, y, width, height} 左上角坐标和尺寸
 */
export function pointsToRect(points: [[number, number], [number, number]]): { x: number, y: number, width: number, height: number } {
	const [p1, p2] = points;
	const x = Math.min(p1[0], p2[0]);
	const y = Math.min(p1[1], p2[1]);
	const width = Math.abs(p2[0] - p1[0]);
	const height = Math.abs(p2[1] - p1[1]);
	return { x, y, width, height };
}

/**
 * 将矩形坐标对象转换为 points 数组。
 *
 * 结果保留一位小数，减小 JSON 体积。
 *
 * @returns [[x1, y1], [x2, y2]] 对角点坐标
 */
export function rectToPoints(rect: { x: number, y: number, width: number, height: number }): [[number, number], [number, number]] {
	const round = (v: number) => Math.round(v * 10) / 10;
	return [
		[round(rect.x), round(rect.y)],
		[round(rect.x + rect.width), round(rect.y + rect.height)],
	];
}

// ============================================================================
// JSON 与内部表示互转
// ============================================================================

/**
 * 将外部 AnnotationShape 转换为内部 InternalRect。
 *
 * 转换过程：
 * 1. 将 points 转为 {x, y, width, height}
 * 2. 保留原始 shape 中的非核心字段到 extra 中
 * 3. 若 shape 提供了 id 则复用，否则生成新的 UUID
 *
 * @param shape - 外部标注形状
 * @param index - 在列表中的索引，用于生成 order
 * @returns 内部矩形对象
 */
export function shapeToInternalRect(shape: AnnotationShape, index: number): InternalRect {
	const { x, y, width, height } = pointsToRect(shape.points);
	// 解构出核心字段，剩余字段放入 extra 保留
	const { label, score, points: _points, shape_type: _shapeType, ...extra } = shape;
	return {
		id: shape.id || createId(),
		order: index + 1,
		label,
		score,
		x,
		y,
		width: Math.max(0, width),
		height: Math.max(0, height),
		extra: extra as InternalRect["extra"],
	};
}

/**
 * 将内部 InternalRect 转换回外部 AnnotationShape。
 *
 * 合并核心字段（label、score、points、shape_type）和 extra 中保留的原始字段。
 *
 * @param rect - 内部矩形对象
 * @returns 外部标注形状
 */
export function internalRectToShape(rect: InternalRect): AnnotationShape {
	return {
		label: rect.label,
		score: rect.score,
		points: rectToPoints(rect),
		shape_type: "rectangle",
		...rect.extra,
	};
}

/**
 * 将外部 AnnotationData 转换为内部 InternalRect 数组。
 *
 * 过滤掉非矩形类型的形状（当前组件仅支持矩形）。
 *
 * @param data - 外部标注数据
 * @returns 内部矩形数组
 */
export function annotationsToInternalRects(data: AnnotationData): InternalRect[] {
	return data.shapes
		.filter(s => s.shape_type === "rectangle")
		.map((shape, index) => shapeToInternalRect(shape, index));
}

/**
 * 将内部矩形数组转换回外部 AnnotationData。
 *
 * @param rects - 内部矩形数组
 * @param fallback - 图片元信息回退值
 * @returns 完整的标注数据结构
 */
export function internalRectsToAnnotationData(rects: InternalRect[], fallback: Partial<AnnotationData> = {}): AnnotationData {
	return {
		version: fallback.version ?? "4.0.0-beta.5",
		flags: fallback.flags ?? {},
		shapes: rects.map(internalRectToShape),
		imagePath: fallback.imagePath ?? "img.png",
		imageData: fallback.imageData ?? null,
		imageHeight: fallback.imageHeight ?? 0,
		imageWidth: fallback.imageWidth ?? 0,
	};
}

/**
 * 深度克隆矩形数组。
 *
 * 确保 extra 对象也被独立复制，避免引用污染。
 */
export function cloneRects(rects: InternalRect[]): InternalRect[] {
	return rects.map(r => ({ ...r, extra: { ...r.extra } }));
}

/**
 * 重新计算并规范化矩形顺序（order）。
 *
 * 删除矩形后调用此函数，确保所有矩形的 order 从 1 开始连续递增。
 */
export function normalizeRectOrder(rects: InternalRect[]): InternalRect[] {
	return rects.map((rect, index) => ({ ...rect, order: index + 1 }));
}

// ============================================================================
// 通用工具函数
// ============================================================================

/**
 * 生成唯一标识符。
 *
 * 优先使用 crypto.randomUUID()，在不支持的环境中回退到时间戳+随机数。
 */
function createId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * 将数值限制在 [min, max] 范围内。
 *
 * @param value - 原始值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 限制后的值
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
