import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { AnnotationData, ImageAnnotationViewerProps, InteractionState, InternalRect, ResizeHandle } from "./types";

import { Button, Input, Space, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	annotationsToInternalRects,
	clamp,
	getLabelColor,
	internalRectsToAnnotationData,
	normalizeRectOrder,
} from "./utils";

/** 矩形框的最小尺寸（像素），小于此值会被忽略 */
const MIN_RECT_SIZE = 4;

/**
 * 生成唯一标识符，用于矩形框的 id。
 *
 * 优先使用浏览器原生的 crypto.randomUUID()，在不支持的环境中回退到时间戳+随机数。
 */
function createRectId() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** 八个方向的调整大小手柄 */
const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * 手柄方向与 CSS 光标样式的映射。
 *
 * 用户将鼠标悬停在不同位置的手柄上时，光标会变为对应的调整大小样式，
 * 以直观提示拖拽方向。
 */
const RESIZE_CURSOR_MAP: Record<ResizeHandle, string> = {
	nw: "nwse-resize",
	n: "ns-resize",
	ne: "nesw-resize",
	e: "ew-resize",
	se: "nwse-resize",
	s: "ns-resize",
	sw: "nesw-resize",
	w: "ew-resize",
};

/**
 * 图片标注查看器组件。
 *
 * 功能概述：
 * - 在图片上显示矩形标注框，支持拖拽移动、八方向调整大小
 * - 支持绘制新的矩形框（在图片上拖拽）
 * - 支持键盘 Delete/Backspace 删除选中的矩形框
 * - 顶部工具栏可修改标签名、删除选中框、清空所有框
 * - 通过 onChange 回调将编辑后的标注数据同步给父组件
 * - 通过 onSelect 回调通知父组件当前选中的矩形框
 *
 * 坐标系说明：
 * - 所有内部坐标基于原始图片的像素坐标系（naturalSize）
 * - 渲染时通过 imageViewport.scaleX/scaleY 将原始坐标映射到视口坐标
 * - 用户的鼠标/指针事件坐标先通过 getImagePoint 转换为原始图片坐标，再参与计算
 */
export function ImageAnnotationViewer(props: ImageAnnotationViewerProps) {
	const { imageUrl, imageWidth, imageHeight, annotations, disabled, style, className, onChange, onSelect } = props;

	// ---- Refs ----
	/** 外层容器 DOM 引用，用于测量尺寸 */
	const containerRef = useRef<HTMLDivElement | null>(null);
	/** 图片覆盖层 DOM 引用，用于接收指针事件 */
	const overlayRef = useRef<HTMLDivElement | null>(null);
	/** onChange 回调的 ref，避免在 useEffect 依赖中添加回调函数 */
	const onChangeRef = useRef(onChange);
	/** onSelect 回调的 ref，避免在 useEffect 依赖中添加回调函数 */
	const onSelectRef = useRef(onSelect);
	/**
	 * 最近一次通过 onChange 发出的 shapes 序列化字符串。
	 * 用于比较当前 rects 是否与已发出的一致，避免重复回调。
	 */
	const lastEmittedRef = useRef<string>("");

	// ---- State ----
	/** 容器（外层 div）的宽度和高度 */
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	/** 图片的原始尺寸（naturalWidth/naturalHeight） */
	const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
	/** 图片加载状态 */
	const [imageStatus, setImageStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
	/** 当前选中的矩形框 id */
	const [selectedRectId, setSelectedRectId] = useState<string | undefined>(undefined);
	/** 当前交互状态（绘制/移动/调整大小） */
	const [interaction, setInteraction] = useState<InteractionState>(null);
	/** 所有矩形框的内部表示 */
	const [rects, setRects] = useState<InternalRect[]>([]);
	/** 从外部 annotations 中解析出的元信息（version、flags 等），导出时需要 */
	const [fallbackMeta, setFallbackMeta] = useState<Partial<AnnotationData>>({});
	/** 当前工具栏中的标签输入值，用于新建矩形框时自动赋值 */
	const [currentLabel, setCurrentLabel] = useState("未命名");

	// ---- Effects: 标签同步 ----
	/**
	 * 当选中矩形变化时，将工具栏的标签输入同步为该矩形的标签名。
	 * 这样用户修改选中框的标签时，可以直接在工具栏输入框中编辑。
	 */
	useEffect(() => {
		if (!selectedRectId)
			return;
		const rect = rects.find(r => r.id === selectedRectId);
		if (rect)
			setCurrentLabel(rect.label);
	}, [selectedRectId]);

	// ---- Effects: 回调 ref 同步 ----
	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		onSelectRef.current = onSelect;
	}, [onSelect]);

	/**
	 * 当 selectedRectId 变化时，通过 onSelect 通知父组件。
	 *
	 * 使用 ref 调用而非直接调用 props.onSelect，避免将回调加入 useEffect 依赖数组，
	 * 防止父组件传入的匿名函数导致无限重渲染。
	 */
	useEffect(() => {
		if (onSelectRef.current) {
			onSelectRef.current(selectedRectId);
		}
	}, [selectedRectId]);

	// ---- Effects: 解析外部 annotations ----
	/**
	 * 当外部传入的 annotations 变化时，解析为内部 rects。
	 *
	 * 防抖动机制：将当前 shapes 序列化后与 lastEmittedRef 比较，
	 * 若一致则说明是组件自己发出又被回传的数据，跳过重新解析以保持选中状态。
	 *
	 * 选中状态保持：若当前选中的 rect 在新解析的数据中仍然存在，则保留选中状态。
	 */
	useEffect(() => {
		if (!annotations) {
			setRects([]);
			setFallbackMeta({});
			setSelectedRectId(undefined);
			return;
		}

		const incoming = JSON.stringify(annotations.shapes);
		if (incoming === lastEmittedRef.current)
			return;

		const parsed = annotationsToInternalRects(annotations);
		setRects(parsed);
		setFallbackMeta({
			version: annotations.version,
			flags: annotations.flags,
			imagePath: annotations.imagePath,
			imageData: annotations.imageData,
			imageHeight: annotations.imageHeight,
			imageWidth: annotations.imageWidth,
		});
		// 保持选中状态：若选中的 rect 仍然存在则保留，否则取消选中
		setSelectedRectId(prev => (prev && parsed.some(r => r.id === prev) ? prev : undefined));
		setInteraction(null);
	}, [annotations]);

	// ---- Effects: 加载图片 ----
	/**
	 * 当 imageUrl 变化时异步加载图片。
	 *
	 * 图片加载成功后获取其原始尺寸（naturalWidth/Height）。
	 * 若外部提供了 imageWidth/imageHeight，则以传入值为准。
	 */
	useEffect(() => {
		if (!imageUrl)
			return;

		setImageStatus("loading");
		const img = new window.Image();
		img.onload = () => {
			setNaturalSize({
				width: imageWidth ?? img.naturalWidth,
				height: imageHeight ?? img.naturalHeight,
			});
			setImageStatus("ready");
		};
		img.onerror = () => {
			setNaturalSize({ width: 0, height: 0 });
			setImageStatus("error");
		};
		img.src = imageUrl;
	}, [imageUrl, imageWidth, imageHeight]);

	// ---- Effects: 监听容器尺寸变化 ----
	/**
	 * 使用 ResizeObserver 监听容器尺寸变化，实时更新 containerSize。
	 *
	 * containerSize 变化会触发 imageViewport 重新计算，确保矩形框始终与图片正确对齐。
	 */
	useEffect(() => {
		const container = containerRef.current;
		if (!container)
			return;

		const update = () => {
			setContainerSize({ width: container.clientWidth, height: container.clientHeight });
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	// ---- Effects: 键盘删除 ----
	/**
	 * 监听键盘 Delete/Backspace 键，删除当前选中的矩形框。
	 *
	 * 仅在存在选中矩形且未禁用时生效。
	 */
	useEffect(() => {
		if (!selectedRectId || disabled)
			return;

		const handle = (e: KeyboardEvent) => {
			if (e.key === "Backspace" || e.key === "Delete") {
				e.preventDefault();
				setRects((prev) => {
					const next = normalizeRectOrder(prev.filter(r => r.id !== selectedRectId));
					return next;
				});
				setSelectedRectId(undefined);
			}
		};
		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [disabled, selectedRectId]);

	// ---- Effects: 发出 onChange ----
	/**
	 * 当 rects 或 fallbackMeta 变化时，将内部数据转换为外部格式并通过 onChange 发出。
	 *
	 * 防抖动：将发出的 shapes 序列化后缓存到 lastEmittedRef，
	 * 若与上次发出的一致则跳过，避免无意义的重复回调。
	 */
	useEffect(() => {
		if (!onChangeRef.current)
			return;
		const data = internalRectsToAnnotationData(rects, fallbackMeta);
		const emitted = JSON.stringify(data.shapes);
		if (emitted !== lastEmittedRef.current) {
			lastEmittedRef.current = emitted;
			onChangeRef.current(data);
		}
	}, [rects, fallbackMeta]);

	// ---- Computed: 图片视口 ----
	/**
	 * 计算图片在容器中的实际显示区域（视口）。
	 *
	 * 采用等比缩放策略：取容器宽高比与图片宽高比中的较小者作为缩放比例，
	 * 使图片完整显示在容器内（letterboxing 效果）。
	 *
	 * 返回值包含：
	 * - left/top: 图片在容器中的偏移量（居中时两侧留白）
	 * - width/height: 图片的实际显示尺寸
	 * - scaleX/scaleY: 原始坐标到视口坐标的缩放比例
	 */
	const imageViewport = useMemo(() => {
		if (!containerSize.width || !containerSize.height || !naturalSize.width || !naturalSize.height) {
			return null;
		}
		const scale = Math.min(
			containerSize.width / naturalSize.width,
			containerSize.height / naturalSize.height,
		);
		const width = naturalSize.width * scale;
		const height = naturalSize.height * scale;
		return {
			left: (containerSize.width - width) / 2,
			top: (containerSize.height - height) / 2,
			width,
			height,
			scaleX: width / naturalSize.width,
			scaleY: height / naturalSize.height,
		};
	}, [containerSize, naturalSize]);

	// ---- Computed: 绘制中的草稿矩形 ----
	/**
	 * 当用户正在拖拽绘制新矩形时，计算当前的草稿矩形。
	 *
	 * 取拖拽起始点和当前点的最小/最大值作为左上角，
	 * 取绝对差值作为宽高。
	 */
	const draftRect = useMemo(() => {
		if (!interaction || interaction.type !== "draw")
			return null;
		const x = Math.min(interaction.start.x, interaction.current.x);
		const y = Math.min(interaction.start.y, interaction.current.y);
		const w = Math.abs(interaction.current.x - interaction.start.x);
		const h = Math.abs(interaction.current.y - interaction.start.y);
		return { x, y, width: w, height: h };
	}, [interaction]);

	// ---- Helper: 指针坐标转图片坐标 ----
	/**
	 * 将鼠标/指针的客户端坐标转换为原始图片像素坐标。
	 *
	 * 计算步骤：
	 * 1. 获取覆盖层（overlay）的 bounding rect
	 * 2. 计算指针相对于覆盖层左上角的偏移量
	 * 3. 根据覆盖层尺寸与原始图片尺寸的比值，将偏移量映射回原始坐标
	 *
	 * @returns {x, y} 原始图片坐标，若无法计算则返回 null
	 */
	const getImagePoint = useCallback(
		(e: ReactPointerEvent<HTMLElement>) => {
			const el = overlayRef.current;
			if (!el || !naturalSize.width || !naturalSize.height)
				return null;
			const bounds = el.getBoundingClientRect();
			if (!bounds.width || !bounds.height)
				return null;
			const x = clamp(e.clientX - bounds.left, 0, bounds.width) * (naturalSize.width / bounds.width);
			const y = clamp(e.clientY - bounds.top, 0, bounds.height) * (naturalSize.height / bounds.height);
			return { x, y };
		},
		[naturalSize],
	);

	// ---- Pointer Event Handlers ----
	/**
	 * 覆盖层指针按下：开始绘制新矩形。
	 *
	 * 仅当左键点击、未禁用、图片已就绪时生效。
	 * 设置 pointer capture 确保拖拽过程中持续接收指针事件。
	 * 取消当前选中状态，准备绘制新矩形。
	 */
	const handleOverlayPointerDown = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			if (disabled || e.button !== 0 || imageStatus !== "ready")
				return;
			const point = getImagePoint(e);
			if (!point)
				return;
			e.currentTarget.setPointerCapture(e.pointerId);
			setInteraction({ type: "draw", start: point, current: point });
			setSelectedRectId(undefined);
		},
		[disabled, getImagePoint, imageStatus],
	);

	/**
	 * 覆盖层指针移动：更新交互状态。
	 *
	 * 根据当前交互类型分别处理：
	 * - draw: 更新 current 点， draftRect 会随之更新
	 * - resize: 根据拖拽距离计算新的矩形尺寸和位置，限制最小尺寸和边界
	 * - move: 根据拖拽距离移动矩形位置，限制在图片边界内
	 */
	const handleOverlayPointerMove = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			if (disabled || !interaction)
				return;
			const point = getImagePoint(e);
			if (!point)
				return;

			// 绘制模式：更新当前拖拽点
			if (interaction.type === "draw") {
				setInteraction({ ...interaction, current: point });
				return;
			}

			// 调整大小模式：根据手柄方向计算新尺寸
			if (interaction.type === "resize") {
				const dx = point.x - interaction.start.x;
				const dy = point.y - interaction.start.y;
				const { origin, handle } = interaction;

				setRects((prev) => {
					return prev.map((r) => {
						if (r.id !== interaction.rectId)
							return r;

						let { x, y, width, height } = origin;

						// 根据手柄方向调整对应边
						if (handle.includes("e"))
							width = origin.width + dx;
						if (handle.includes("w")) {
							x = origin.x + dx;
							width = origin.width - dx;
						}
						if (handle.includes("s"))
							height = origin.height + dy;
						if (handle.includes("n")) {
							y = origin.y + dy;
							height = origin.height - dy;
						}

						// 限制最小尺寸
						if (width < MIN_RECT_SIZE) {
							if (handle.includes("w"))
								x = origin.x + origin.width - MIN_RECT_SIZE;
							width = MIN_RECT_SIZE;
						}
						if (height < MIN_RECT_SIZE) {
							if (handle.includes("n"))
								y = origin.y + origin.height - MIN_RECT_SIZE;
							height = MIN_RECT_SIZE;
						}

						// 限制在图片边界内
						x = clamp(x, 0, naturalSize.width - width);
						y = clamp(y, 0, naturalSize.height - height);
						width = clamp(width, MIN_RECT_SIZE, naturalSize.width - x);
						height = clamp(height, MIN_RECT_SIZE, naturalSize.height - y);

						return { ...r, x, y, width, height };
					});
				});
				return;
			}

			// 移动模式：根据拖拽距离平移矩形
			setRects((prev) => {
				return prev.map((r) => {
					if (r.id !== interaction.rectId)
						return r;
					const dx = point.x - interaction.start.x;
					const dy = point.y - interaction.start.y;
					return {
						...r,
						x: clamp(interaction.origin.x + dx, 0, Math.max(0, naturalSize.width - r.width)),
						y: clamp(interaction.origin.y + dy, 0, Math.max(0, naturalSize.height - r.height)),
					};
				});
			});
		},
		[disabled, getImagePoint, interaction, naturalSize],
	);

	/**
	 * 覆盖层指针抬起：结束交互。
	 *
	 * 如果是绘制模式且矩形尺寸大于最小值，则将草稿矩形正式添加到 rects 中。
	 * 释放 pointer capture，清除交互状态。
	 */
	const handleOverlayPointerUp = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			if (!interaction)
				return;
			e.currentTarget.releasePointerCapture(e.pointerId);

			// 绘制模式：将草稿矩形转为正式矩形
			if (interaction.type === "draw" && draftRect && draftRect.width >= MIN_RECT_SIZE && draftRect.height >= MIN_RECT_SIZE) {
				setRects((prev) => {
					const newRect: InternalRect = {
						id: createRectId(),
						order: prev.length + 1,
						label: currentLabel,
						score: undefined,
						x: draftRect.x,
						y: draftRect.y,
						width: draftRect.width,
						height: draftRect.height,
						extra: {
							group_id: null,
							description: null,
							difficult: false,
							flags: null,
							attributes: {},
							kie_linking: [],
						},
					};
					return normalizeRectOrder([...prev, newRect]);
				});
			}

			setInteraction(null);
		},
		[draftRect, interaction],
	);

	/**
	 * 矩形框指针按下：选中该矩形并准备移动。
	 *
	 * 阻止事件冒泡，避免触发覆盖层的绘制逻辑。
	 * 设置 pointer capture 确保拖拽过程中持续接收事件。
	 */
	const handleRectPointerDown = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>, rect: InternalRect) => {
			e.stopPropagation();
			setSelectedRectId(rect.id);
			if (disabled || e.button !== 0)
				return;
			const point = getImagePoint(e);
			if (!point)
				return;
			e.currentTarget.setPointerCapture(e.pointerId);
			setInteraction({
				type: "move",
				rectId: rect.id,
				start: point,
				origin: { x: rect.x, y: rect.y },
			});
		},
		[disabled, getImagePoint],
	);

	/**
	 * 调整大小手柄指针按下：准备调整矩形尺寸。
	 *
	 * 阻止事件冒泡，避免触发矩形框的移动逻辑。
	 * 在覆盖层上设置 pointer capture（手柄太小，在覆盖层上捕获更稳定）。
	 */
	const handleResizePointerDown = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>, rect: InternalRect, handle: ResizeHandle) => {
			e.stopPropagation();
			e.preventDefault();
			if (disabled || e.button !== 0)
				return;
			const point = getImagePoint(e);
			if (!point)
				return;
			overlayRef.current?.setPointerCapture(e.pointerId);
			setInteraction({
				type: "resize",
				rectId: rect.id,
				handle,
				start: point,
				origin: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
			});
		},
		[disabled, getImagePoint],
	);

	// ---- Toolbar Handlers ----
	/** 删除当前选中的矩形框 */
	const handleDeleteSelected = useCallback(() => {
		if (!selectedRectId)
			return;
		setRects(prev => normalizeRectOrder(prev.filter(r => r.id !== selectedRectId)));
		setSelectedRectId(undefined);
	}, [selectedRectId]);

	/** 清空所有矩形框 */
	const handleClear = useCallback(() => {
		setRects([]);
		setSelectedRectId(undefined);
	}, []);

	/**
	 * 修改工具栏中的标签名。
	 *
	 * 若当前有选中的矩形框，同时更新该矩形框的标签。
	 */
	const handleLabelChange = useCallback(
		(value: string) => {
			setCurrentLabel(value);
			if (selectedRectId) {
				setRects((prev) => {
					return prev.map((r) => {
						if (r.id !== selectedRectId)
							return r;
						return { ...r, label: value };
					});
				});
			}
		},
		[selectedRectId],
	);

	/** 提取所有已使用的唯一标签名列表，用于工具栏展示 */
	const uniqueLabels = useMemo(() => {
		const set = new Set(rects.map(r => r.label));
		return [...set];
	}, [rects]);

	const handleOverlayKeyDown = useCallback(
		(e: ReactKeyboardEvent<HTMLDivElement>) => {
			if (disabled) {
				return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedRectId) {
					e.preventDefault();
					handleDeleteSelected();
				}
			}
		},
		[disabled, selectedRectId, handleDeleteSelected],
	);

	const handleRectKeyDown = useCallback(
		(rect: InternalRect, e: ReactKeyboardEvent<HTMLDivElement>) => {
			if (disabled) {
				return;
			}
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				setSelectedRectId(rect.id);
			}
			else if (e.key === "Delete" || e.key === "Backspace") {
				e.preventDefault();
				setRects(prev => normalizeRectOrder(prev.filter(r => r.id !== rect.id)));
				setSelectedRectId(prev => (prev === rect.id ? undefined : prev));
			}
		},
		[disabled],
	);

	const ariaStatus = selectedRectId
		? "已选中标注框"
		: rects.length > 0
			? `共 ${rects.length} 个标注框`
			: "暂无标注框";

	// ---- Render ----
	return (
		<div className={className} style={{ height: "100%", display: "flex", flexDirection: "column", ...style }}>
			<span role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
				{ariaStatus}
			</span>
			{/* 顶部工具栏：标签输入、删除选中、清空、已有标签展示 */}
			<div style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 16px" }}>
				<Space size={[8, 8]} wrap>
					<Typography.Text strong>标签</Typography.Text>
					<Input
						aria-label="标签"
						size="small"
						value={currentLabel}
						onChange={e => handleLabelChange(e.target.value)}
						disabled={disabled}
						className="w-[120px]"
						placeholder="输入标签名"
					/>
					<Button
						size="small"
						onClick={handleDeleteSelected}
						disabled={disabled || !selectedRectId}
					>
						删除选中
					</Button>
					<Button
						size="small"
						onClick={handleClear}
						disabled={disabled || rects.length === 0}
					>
						清空
					</Button>
					{uniqueLabels.length > 0 && <Typography.Text strong>已有标签</Typography.Text>}
					{uniqueLabels.map(label => (
						<span
							key={label}
							style={{
								display: "inline-block",
								padding: "1px 8px",
								fontSize: 12,
								lineHeight: "20px",
								borderRadius: 4,
								background: getLabelColor(label),
								color: "#fff",
							}}
						>
							{label}
						</span>
					))}
				</Space>
			</div>

			{/* 图片画布区域 */}
			<div
				ref={containerRef}
				style={{ flex: 1, minHeight: 0, position: "relative", background: "#f7f7f7" }}
			>
				{imageViewport && imageStatus !== "error" && (
					<>
						{/* 实际显示的图片 */}
						<img
							src={imageUrl}
							alt="待标注图片"
							draggable={false}
							style={{
								position: "absolute",
								left: imageViewport.left,
								top: imageViewport.top,
								width: imageViewport.width,
								height: imageViewport.height,
								objectFit: "fill",
								userSelect: "none",
								pointerEvents: "none",
							}}
						/>

						{/*
							交互覆盖层：接收所有指针事件（点击、拖拽）。
							其位置与图片完全重合，作为事件接收的透明层。
							光标样式根据当前状态变化：
							- 禁用时：not-allowed
							- 绘制中：crosshair（十字准星）
							- 默认：default
						*/}
						<div
							ref={overlayRef}
							onPointerDown={handleOverlayPointerDown}
							onPointerMove={handleOverlayPointerMove}
							onPointerUp={handleOverlayPointerUp}
							onPointerCancel={handleOverlayPointerUp}
							role="img"
							tabIndex={disabled ? -1 : 0}
							aria-label={`标注画布，共 ${rects.length} 个标注框${selectedRectId ? "，已选中一个" : ""}`}
							onKeyDown={handleOverlayKeyDown}
							style={{
								position: "absolute",
								left: imageViewport.left,
								top: imageViewport.top,
								width: imageViewport.width,
								height: imageViewport.height,
								cursor: disabled ? "not-allowed" : interaction?.type === "draw" ? "crosshair" : "default",
							}}
						>
							{/* 已存在的矩形框 */}
							{rects.map((rect) => {
								const color = getLabelColor(rect.label);
								// 将原始图片坐标转换为视口坐标（像素）
								const left = rect.x * imageViewport.scaleX;
								const top = rect.y * imageViewport.scaleY;
								const width = rect.width * imageViewport.scaleX;
								const height = rect.height * imageViewport.scaleY;

								return (
									<div
										key={rect.id}
										role="button"
										tabIndex={disabled ? -1 : 0}
										aria-label={`标注框 ${rect.order} ${rect.label}，位置 ${Math.round(rect.x)} ${Math.round(rect.y)}，尺寸 ${Math.round(rect.width)} 乘 ${Math.round(rect.height)}`}
										aria-pressed={selectedRectId === rect.id}
										onPointerDown={e => handleRectPointerDown(e, rect)}
										onKeyDown={e => handleRectKeyDown(rect, e)}
										style={{
											position: "absolute",
											left,
											top,
											width,
											height,
											border: `2px solid ${color}`,
											// 选中时添加外发光效果
											boxShadow: selectedRectId === rect.id ? `0 0 0 2px ${color}55` : "none",
											background: `${color}15`,
											cursor: disabled ? "not-allowed" : "move",
											boxSizing: "border-box",
										}}
									>
										{/* 标签名和置信度浮层，显示在矩形框上方 */}
										<div
											style={{
												position: "absolute",
												left: 0,
												top: 0,
												transform: "translateY(-100%)",
												background: color,
												color: "#fff",
												fontSize: 12,
												padding: "1px 6px",
												lineHeight: "20px",
												whiteSpace: "nowrap",
												display: "flex",
												gap: 4,
												alignItems: "baseline",
											}}
										>
											<span>{`${rect.order} ${rect.label}`}</span>
											{rect.score != null && (
												<span style={{ opacity: 0.8, fontSize: 11 }}>{rect.score.toFixed(2)}</span>
											)}
										</div>

										{/* 选中时显示八个方向的调整大小手柄 */}
										{selectedRectId === rect.id && !disabled && (() => {
											const hSize = 8;
											return RESIZE_HANDLES.map((handle) => {
												// 根据手柄方向计算在矩形框内的位置
												let hLeft = 0;
												let hTop = 0;
												if (handle.includes("n"))
													hTop = -hSize / 2;
												else if (handle.includes("s"))
													hTop = height - hSize / 2;
												else hTop = height / 2 - hSize / 2;
												if (handle.includes("w"))
													hLeft = -hSize / 2;
												else if (handle.includes("e"))
													hLeft = width - hSize / 2;
												else hLeft = width / 2 - hSize / 2;

												return (
													<div
														key={handle}
														onPointerDown={e => handleResizePointerDown(e, rect, handle)}
														style={{
															position: "absolute",
															left: hLeft,
															top: hTop,
															width: hSize,
															height: hSize,
															background: "#fff",
															border: `2px solid ${color}`,
															cursor: RESIZE_CURSOR_MAP[handle],
															boxSizing: "border-box",
															zIndex: 2,
														}}
													/>
												);
											});
										})()}
									</div>
								);
							})}

							{/* 绘制中的草稿矩形（虚线边框） */}
							{draftRect && (
								<div
									style={{
										position: "absolute",
										left: draftRect.x * imageViewport.scaleX,
										top: draftRect.y * imageViewport.scaleY,
										width: draftRect.width * imageViewport.scaleX,
										height: draftRect.height * imageViewport.scaleY,
										border: "2px dashed #1890ff",
										background: "rgba(24,144,255,0.12)",
										pointerEvents: "none",
										boxSizing: "border-box",
									}}
								/>
							)}
						</div>
					</>
				)}

				{/* 图片加载中状态 */}
				{imageStatus === "loading" && (
					<div role="status" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
						<Typography.Text type="secondary">图片加载中...</Typography.Text>
					</div>
				)}
				{/* 图片加载失败状态 */}
				{imageStatus === "error" && (
					<div role="alert" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
						<Typography.Text type="danger">图片加载失败，请检查资源路径</Typography.Text>
					</div>
				)}
			</div>
		</div>
	);
}
