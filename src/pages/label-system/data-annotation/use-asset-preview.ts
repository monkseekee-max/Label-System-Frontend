// 资产预览加载 hook (P2-10 Phase A: 从 index.tsx 提取, 原 useffectPreview)
// 从 /raw 获取二进制并生成 object URL; 切换资产时重置所有交互状态.
import type { DataAsset } from "#src/api/label-system";
import type { DetailAnalysis, ImageSelection, VideoWindowState } from "./types";

import { fetchAssetRaw } from "#src/api/label-system";

import { useEffect } from "react";

export function useAssetPreview(
	asset: DataAsset | null,
	setPreviewUrl: (v: string | null) => void,
	setImageSelection: (v: ImageSelection | null) => void,
	setVideoWindow: React.Dispatch<React.SetStateAction<VideoWindowState>>,
	setDetailAnalysis: (v: DetailAnalysis | null) => void,
	setCapturedFrameUrl: (v: string | null) => void,
) {
	useEffect(() => {
		let objectUrl: string | null = null;
		const load = async () => {
			if (!asset?.id || !["image", "video"].includes(asset.data_type)) {
				setPreviewUrl(null);
				return;
			}
			try {
				const blob = await fetchAssetRaw(asset.id);
				objectUrl = URL.createObjectURL(blob);
				setPreviewUrl(objectUrl);
			}
			catch { setPreviewUrl(null); }
		};
		// 切换资产时重置所有交互状态
		setImageSelection(null);
		setVideoWindow({ start: null, end: null, sampleCount: 3, trajectoryLabel: "", startFrame: null, endFrame: null });
		setDetailAnalysis(null);
		setCapturedFrameUrl(null);
		load();
		return () => {
			if (objectUrl)
				URL.revokeObjectURL(objectUrl);
		};
	}, [asset?.id, asset?.data_type]);
}
