import { analyzeVideoFrame, analyzeVideoWindow } from "#src/api/label-system";
import { useCallback } from "react";
import { clamp } from "../helpers";

export function useVideoCapture(videoRef: React.RefObject<HTMLVideoElement | null>) {
	const captureFrame = useCallback((): { dataUrl: string, base64: string } | null => {
		const video = videoRef.current;
		if (!video || !video.videoWidth || !video.videoHeight)
			return null;
		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx)
			return null;
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		const dataUrl = canvas.toDataURL("image/png");
		return { dataUrl, base64: dataUrl.split(",")[1] ?? "" };
	}, [videoRef]);

	const seekTo = useCallback((ts: number) =>
		new Promise<void>((resolve, reject) => {
			const video = videoRef.current;
			if (!video) {
				reject(new Error("视频播放器未就绪"));
				return;
			}
			const duration = Number.isFinite(video.duration) ? video.duration : ts;
			const safeTs = clamp(ts, 0, Math.max(duration, 0));
			if (Math.abs((video.currentTime || 0) - safeTs) < 0.03) {
				requestAnimationFrame(() => resolve());
				return;
			}
			// 超时定时器; 监听器用 once 自动移除, 超时后 Promise 已 reject, 后续 resolve 无效
			const timer = window.setTimeout(() => reject(new Error("视频跳转超时")), 6000);
			video.addEventListener("seeked", () => {
				window.clearTimeout(timer);
				requestAnimationFrame(() => resolve());
			}, { once: true });
			video.addEventListener("error", () => {
				window.clearTimeout(timer);
				reject(new Error("视频跳转失败"));
			}, { once: true });
			video.currentTime = safeTs;
		}), [videoRef]);

	const captureWindowFrames = useCallback(async (timestamps: number[]): Promise<Array<{ timestamp: number, dataUrl: string, base64: string }>> => {
		const out: Array<{ timestamp: number, dataUrl: string, base64: string }> = [];
		for (const ts of timestamps) {
			await seekTo(ts);
			await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
			const f = captureFrame();
			if (!f)
				throw new Error("抓取视频帧失败");
			out.push({ timestamp: ts, dataUrl: f.dataUrl, base64: f.base64 });
		}
		return out;
	}, [seekTo, captureFrame]);

	const analyzeFrame = useCallback(async (assetId: string) => {
		const frame = captureFrame();
		if (!frame)
			return null;
		const timestamp = Number((videoRef.current?.currentTime || 0).toFixed(3));
		const data = await analyzeVideoFrame({ asset_id: assetId, frame_base64: frame.base64, timestamp });
		return { dataUrl: frame.dataUrl, timestamp, data };
	}, [captureFrame, videoRef]);

	const analyzeWindow = useCallback(async (assetId: string, timestamps: number[], trajectoryLabel: string, startTime: number, endTime: number) => {
		const frames = await captureWindowFrames(timestamps);
		const data = await analyzeVideoWindow({
			asset_id: assetId,
			start_timestamp: startTime,
			end_timestamp: endTime,
			trajectory_label: trajectoryLabel,
			frames: frames.map(f => ({ timestamp: f.timestamp, frame_base64: f.base64 })),
		});
		return { framePreviews: frames.map(f => ({ timestamp: f.timestamp, dataUrl: f.dataUrl })), data };
	}, [captureWindowFrames]);

	const getCurrentTime = useCallback(() => videoRef.current?.currentTime ?? 0, [videoRef]);

	return { captureFrame, seekTo, captureWindowFrames, analyzeFrame, analyzeWindow, getCurrentTime };
}
