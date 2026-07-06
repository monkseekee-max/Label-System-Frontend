import type { MediaAsset, MediaAssetListParams, TaskCategory } from "./types";
import { factoryApi } from "./factory-client";
import { delay, toApiResponse, withFallback } from "./shared";

const MOCK_MEDIA_ASSETS: MediaAsset[] = [
	{
		id: "media-1",
		mediaId: "image_1718012345_3a7f",
		type: "image",
		fileSize: 1258291,
		mimeType: "image/png",
		width: 2048,
		height: 1536,
		taskCategory: "IMAGE_CAPTION",
		sha256: "3a7f8b2c4d1e5f6a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6",
		uploadedAt: "2025-06-10T14:05:45Z",
		filePath: "/media/assets/image_1718012345_3a7f.png",
	},
	{
		id: "media-2",
		mediaId: "image_1718009876_b2c1",
		type: "image",
		fileSize: 876543,
		mimeType: "image/jpeg",
		width: 1280,
		height: 720,
		taskCategory: "IMAGE_QA",
		sha256: "b2c1d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c",
		uploadedAt: "2025-06-10T12:30:12Z",
		filePath: "/media/assets/image_1718009876_b2c1.jpg",
	},
	{
		id: "media-3",
		mediaId: "video_1717995200_f8d3",
		type: "video",
		fileSize: 50967429,
		mimeType: "video/mp4",
		duration: 135,
		taskCategory: "VIDEO_QA",
		sha256: "f8d3e4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
		uploadedAt: "2025-06-09T16:45:20Z",
		filePath: "/media/assets/video_1717995200_f8d3.mp4",
	},
	{
		id: "media-4",
		mediaId: "video_1717983400_e4a7",
		type: "video",
		fileSize: 126144000,
		mimeType: "video/mp4",
		duration: 342,
		taskCategory: "VIDEO_CAPTION",
		sha256: "e4a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
		uploadedAt: "2025-06-09T11:30:00Z",
		filePath: "/media/assets/video_1717983400_e4a7.mp4",
	},
	{
		id: "media-5",
		mediaId: "image_1717945612_c9d0",
		type: "image",
		fileSize: 2202009,
		mimeType: "image/jpeg",
		width: 4096,
		height: 2160,
		taskCategory: "IMAGE_CAPTION",
		sha256: "c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9",
		uploadedAt: "2025-06-08T18:20:12Z",
		filePath: "/media/assets/image_1717945612_c9d0.jpg",
	},
	{
		id: "media-6",
		mediaId: "image_1717908800_a1b2",
		type: "image",
		fileSize: 524288,
		mimeType: "image/png",
		width: 640,
		height: 480,
		taskCategory: "IMAGE_QA",
		sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
		uploadedAt: "2025-06-07T14:00:00Z",
		filePath: "/media/assets/image_1717908800_a1b2.png",
	},
];

// Media Assets
export function fetchMediaAssetList(params?: MediaAssetListParams) {
	return withFallback(async () => {
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 20;
		const offset = (pageNo - 1) * pageSize;
		const res = await factoryApi.getMedia(params?.type, params?.taskCategory as string | undefined, pageSize, offset);
		const records: MediaAsset[] = res.items.map(m => ({
			id: m.media_id,
			mediaId: m.media_id,
			type: (m.media_type as "image" | "video") || "image",
			fileSize: m.file_size || 0,
			mimeType: m.mime_type || "",
			width: m.width || undefined,
			height: m.height || undefined,
			duration: m.duration || undefined,
			taskCategory: (m.task_type as TaskCategory) || "TEXT_QA",
			sha256: m.checksum_sha256 || "",
			uploadedAt: m.created_at || "",
			filePath: m.file_path,
		}));
		return { records, total: res.total, pageNo, pageSize };
	}, () => delay(300).then(() => {
		let filtered = [...MOCK_MEDIA_ASSETS];
		if (params?.type)
			filtered = filtered.filter(a => a.type === params.type);
		if (params?.taskCategory)
			filtered = filtered.filter(a => a.taskCategory === params.taskCategory);
		if (params?.keyword)
			filtered = filtered.filter(a => a.mediaId.includes(params.keyword!) || a.id.includes(params.keyword!));
		const pageNo = params?.pageNo || 1;
		const pageSize = params?.pageSize || 20;
		const start = (pageNo - 1) * pageSize;
		const records = filtered.slice(start, start + pageSize);
		return toApiResponse({ code: 200, message: "success", data: { records, total: filtered.length, pageNo, pageSize } });
	}));
}

export function fetchMediaAssetStats() {
	return withFallback(async () => {
		const res = await factoryApi.getMedia(undefined, undefined, 1000, 0);
		const items = res.items;
		const images = items.filter(a => a.media_type === "image");
		const videos = items.filter(a => a.media_type === "video");
		return {
			imageCount: images.length,
			videoCount: videos.length,
			totalStorageBytes: items.reduce((s, a) => s + (a.file_size || 0), 0),
			taskTypeCoverage: new Set(items.map(a => a.task_type).filter(Boolean)).size,
		};
	}, () => delay(150).then(() => {
		const images = MOCK_MEDIA_ASSETS.filter(a => a.type === "image");
		const videos = MOCK_MEDIA_ASSETS.filter(a => a.type === "video");
		const totalStorage = MOCK_MEDIA_ASSETS.reduce((sum, a) => sum + a.fileSize, 0);
		return toApiResponse({
			code: 200,
			message: "success",
			data: { imageCount: images.length, videoCount: videos.length, totalStorageBytes: totalStorage, taskTypeCoverage: new Set(MOCK_MEDIA_ASSETS.map(a => a.taskCategory)).size },
		});
	}));
}
