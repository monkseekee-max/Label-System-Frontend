import type { RegionAnalysisResult } from "#src/api/label-system";
import type { ImageSelection } from "../types";
import { analyzeRegion } from "#src/api/label-system";
import { useCallback, useRef, useState } from "react";
import { clamp, formatRegionLabel } from "../helpers";

interface SelectionOrigin {
	x: number
	y: number
	width: number
	height: number
}

export function useImageSelection(imageRef: React.RefObject<HTMLImageElement | null>) {
	const [imageSelection, setImageSelection] = useState<ImageSelection | null>(null);
	const [dragSelection, setDragSelection] = useState<ImageSelection | null>(null);
	// 用 ref 跟踪拖拽起点 (同步可读), 避免 mousedown 后立即 mousemove 时 state 尚未提交导致 move 被忽略 (快速拖拽更可靠)
	const originRef = useRef<SelectionOrigin | null>(null);

	const handleStart = useCallback((e: React.MouseEvent) => {
		if (!imageRef.current)
			return;
		const b = imageRef.current.getBoundingClientRect();
		const x = clamp(e.clientX - b.left, 0, b.width);
		const y = clamp(e.clientY - b.top, 0, b.height);
		originRef.current = { x, y, width: b.width, height: b.height };
		setDragSelection({ left: x, top: y, width: 0, height: 0, normalized: { x: x / b.width, y: y / b.height, width: 0, height: 0 } });
	}, [imageRef]);

	const handleMove = useCallback((e: React.MouseEvent) => {
		const origin = originRef.current;
		if (!origin || !imageRef.current)
			return;
		const b = imageRef.current.getBoundingClientRect();
		const cx = clamp(e.clientX - b.left, 0, b.width);
		const cy = clamp(e.clientY - b.top, 0, b.height);
		const left = Math.min(origin.x, cx);
		const top = Math.min(origin.y, cy);
		const w = Math.abs(cx - origin.x);
		const h = Math.abs(cy - origin.y);
		setDragSelection({ left, top, width: w, height: h, normalized: { x: left / b.width, y: top / b.height, width: w / b.width, height: h / b.height } });
	}, [imageRef]);

	const handleEnd = useCallback(() => {
		if (!dragSelection) {
			originRef.current = null;
			return;
		}
		if (dragSelection.width < 8 || dragSelection.height < 8)
			setImageSelection(null);
		else
			setImageSelection(dragSelection);
		setDragSelection(null);
		originRef.current = null;
	}, [dragSelection]);

	const selectCenter = useCallback(() => {
		if (!imageRef.current)
			return;
		const b = imageRef.current.getBoundingClientRect();
		setImageSelection({ left: b.width * 0.25, top: b.height * 0.25, width: b.width * 0.5, height: b.height * 0.5, normalized: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } });
	}, [imageRef]);

	const cropToBase64 = useCallback((): string | null => {
		if (!imageRef.current || !imageSelection?.normalized)
			return null;
		const img = imageRef.current;
		const n = imageSelection.normalized;
		const sx = Math.max(0, Math.round(n.x * img.naturalWidth));
		const sy = Math.max(0, Math.round(n.y * img.naturalHeight));
		const sw = Math.max(1, Math.round(n.width * img.naturalWidth));
		const sh = Math.max(1, Math.round(n.height * img.naturalHeight));
		const canvas = document.createElement("canvas");
		canvas.width = sw;
		canvas.height = sh;
		const ctx = canvas.getContext("2d");
		if (!ctx)
			return null;
		ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
		return canvas.toDataURL("image/png").split(",")[1] ?? null;
	}, [imageRef, imageSelection]);

	const analyze = useCallback(async (assetId: string): Promise<RegionAnalysisResult | null> => {
		if (!imageSelection)
			return null;
		const b64 = cropToBase64();
		if (!b64)
			return null;
		return analyzeRegion({ asset_id: assetId, image_base64: b64, region_label: formatRegionLabel(imageSelection) });
	}, [imageSelection, cropToBase64]);

	return {
		imageSelection,
		dragSelection,
		handleStart,
		handleMove,
		handleEnd,
		selectCenter,
		clear: () => setImageSelection(null),
		cropToBase64,
		analyze,
	};
}
